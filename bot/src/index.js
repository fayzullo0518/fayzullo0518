/**
 * Botning kirish nuqtasi — hamma qismlarni bog'laydi va yangilanishlarni
 * long polling orqali qabul qiladi.
 */
import { sozlamalar } from './config.js';
import { Daftar } from './store.js';
import { Telegram, esc } from './telegram.js';
import { Agent, agentXatosi } from './agent.js';
import { ovozdanMatn, OvozXatosi } from './asr.js';
import { eslatmaniBoshlash, tugmalar } from './eslatma.js';
import { excelTuzish, oylikHisobotMatni, ochiqlarMatni, qisqaSatr } from './hisobot.js';
import { vositaniBajarish } from './vositalar.js';
import { hozir, oldingiOy } from './vaqt.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUYRUQLAR = [
  { command: 'royxat', description: 'Qaytarilmaganlar ro‘yxati' },
  { command: 'excel', description: 'Excel hisobot yuborish' },
  { command: 'oy', description: 'Shu oy bo‘yicha hisobot' },
  { command: 'otganoy', description: 'O‘tgan oy bo‘yicha hisobot' },
  { command: 'bekor', description: 'Suhbat tarixini tozalash' },
  { command: 'id', description: 'Telegram ID ni ko‘rsatish' },
  { command: 'yordam', description: 'Qanday ishlashi haqida' },
];

const yordamMatni = (cfg) => `\u{1F4D2} <b>Daftar bot</b>

Menga oddiy qilib yozing yoki ovozli xabar yuboring — o‘zim tushunib yozib qo‘yaman.

<b>Misollar:</b>
• "Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to‘laydi"
• "Jasurga kardiograf vaqtincha berdim, 20 kundan keyin qaytaradi"
• "Akmalga 5 mln qarz berdim, oyning oxirida qaytaradi"
• "Sardor qaytardi" — yozuvni yopaman
• "Akmal 2 mln berdi" — qisman to‘lov qilib belgilayman

<b>Ovozli xabar:</b>
Eshitganimni yozma holatda qaytarib yuboraman. Noto‘g‘ri bo‘lsa tuzatib
yozasiz. ${cfg.tasdiqDaqiqa} daqiqada javob bo‘lmasa, to‘g‘ri deb saqlayman.

<b>Buyruqlar:</b>
/royxat — qaytarilmaganlar
/excel — Excel fayl (3 varaq)
/oy — shu oy hisoboti
/otganoy — o‘tgan oy hisoboti
/bekor — suhbat tarixini tozalash

Har kuni soat ${cfg.eslatmaSoati}:00 da muddati kelganlarni eslataman,
har oy boshida o‘tgan oy yakunini yuboraman.`;

async function asosiy() {
  let cfg;
  try {
    cfg = sozlamalar();
  } catch (xato) {
    console.error(`\n❌ ${xato.message}\n`);
    process.exit(1);
  }

  const daftar = new Daftar(cfg.bazaYoli);
  const telegram = new Telegram(cfg.token, cfg.telegramAsos);
  const agent = new Agent(cfg, daftar);

  const men = await telegram.chaqir('getMe').catch((xato) => {
    console.error(`\n❌ Telegramga ulanib bo‘lmadi: ${xato.message}\n`);
    process.exit(1);
  });

  // webhook o'rnatilgan bo'lsa long polling umuman ishlamaydi (409)
  const webhook = await telegram.webhookMalumoti().catch(() => null);
  if (webhook?.url) {
    console.error([
      '',
      "\u274C Bu botga webhook o'rnatilgan:",
      `     ${webhook.url}`,
      '',
      '   Webhook va long polling birga ishlamaydi, shuning uchun bot',
      '   xabarlarni ololmaydi. Webhook ni olib tashlash:',
      '',
      '     npm run webhook-ochir',
      '',
      '   Shundan keyin qaytadan:  npm start',
      '',
    ].join('\n'));
    process.exit(1);
  }

  await telegram.setMyCommands(BUYRUQLAR);

  console.log(`✅ @${men.username} ishga tushdi`);
  console.log(`   Baza:     ${cfg.bazaYoli} (${daftar.yozuvlar.length} yozuv)`);
  console.log(`   Model:    ${cfg.xizmat} / ${cfg.model}${cfg.effort ? ` (effort: ${cfg.effort})` : ''}`);
  console.log(`   Vaqt:     ${cfg.vaqtMintaqasi}, eslatma soat ${cfg.eslatmaSoati}:00`);
  console.log(`   Ovoz:     ${cfg.asr === 'yoq' ? 'o‘chirilgan (kalit yo‘q)' : cfg.asr}, tasdiq ${cfg.tasdiqDaqiqa} daqiqa`);
  console.log(`   Ega:      ${cfg.egaId || 'BELGILANMAGAN — botga /id yozing'}`);

  if (cfg.egaId) {
    // birinchi ishga tushishda o'tgan oy hisoboti darrov kelib qolmasin
    if (!daftar.baza.holat.oxirgiOylikHisobot) {
      daftar.holatniYozish('oxirgiOylikHisobot', oldingiOy(hozir(cfg.vaqtMintaqasi).oyKodi));
    }
    eslatmaniBoshlash({ daftar, telegram, cfg, chatId: cfg.egaId });
  } else {
    console.warn('   ⚠ OWNER_ID yo‘q — eslatmalar ishlamaydi.');
  }

  await pollingHalqasi({ telegram, daftar, agent, cfg });
}

/* ------------------------------------------------------------------ */
/* yangilanishlarni qabul qilish                                       */
/* ------------------------------------------------------------------ */

async function pollingHalqasi({ telegram, daftar, agent, cfg }) {
  let offset = 0;
  let kechikish = 1000;

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log('\n\u{1F44B} To‘xtatilmoqda…');
      process.exit(0);
    });
  }

  for (;;) {
    let yangilanishlar;
    try {
      yangilanishlar = await telegram.getUpdates(offset);
      kechikish = 1000;
    } catch (xato) {
      if (xato.kod === 409) {
        console.error([
          '',
          '\u274C Telegram 409: bu bot tokeni band.',
          '',
          '   Ikki sababdan biri:',
          '',
          "   1) Bot boshqa joyda ham ishlayapti - eski nusxasini to'xtating.",
          '      Windows:  Get-Process node | Select-Object Id, StartTime',
          '                Stop-Process -Id <ID>',
          '      Linux:    sudo systemctl stop daftar-bot',
          '                pkill -f "node src/index.js"',
          '',
          "   2) Botga webhook o'rnatilgan:",
          '      npm run webhook-ochir',
          '',
          '   Qaysi biri ekanini bilish uchun:  npm run tekshir',
          '',
        ].join('\n'));
      } else {
        console.error(`[polling] ${xato.message} — ${Math.round(kechikish / 1000)}s dan keyin qayta`);
      }
      await kut(kechikish);
      kechikish = Math.min(kechikish * 2, 60000);
      continue;
    }

    for (const yangilanish of yangilanishlar) {
      offset = yangilanish.update_id + 1;
      try {
        if (yangilanish.message) {
          await xabarniIshlash(yangilanish.message, { telegram, daftar, agent, cfg });
        } else if (yangilanish.callback_query) {
          await tugmaniIshlash(yangilanish.callback_query, { telegram, daftar, cfg });
        }
      } catch (xato) {
        console.error('[yangilanish]', xato);
        const chatId = yangilanish.message?.chat?.id || yangilanish.callback_query?.message?.chat?.id;
        if (chatId) {
          await telegram.sendMessage(chatId, `⚠ ${esc(agentXatosi(xato))}`).catch(() => null);
        }
      }
    }
  }
}

const kut = (ms) => new Promise((yechim) => { setTimeout(yechim, ms); });

/* ------------------------------------------------------------------ */
/* xabarlar                                                            */
/* ------------------------------------------------------------------ */

async function xabarniIshlash(xabar, { telegram, daftar, agent, cfg }) {
  const chatId = xabar.chat.id;
  const kimdan = xabar.from?.id;

  // /id — kim bo'lishidan qat'i nazar ishlaydi, sozlash uchun kerak
  if (xabar.text && /^\/id\b/.test(xabar.text)) {
    await telegram.sendMessage(
      chatId,
      `Sizning Telegram ID: <code>${kimdan}</code>\n\n.env fayldagi OWNER_ID ga shu raqamni yozing va botni qayta ishga tushiring.`,
    );
    return;
  }

  if (!cfg.egaId) {
    await telegram.sendMessage(
      chatId,
      '⚠ Bot hali sozlanmagan. /id yozing va chiqqan raqamni .env fayldagi OWNER_ID ga qo‘ying.',
    );
    return;
  }
  if (kimdan !== cfg.egaId) {
    console.warn(`[ruxsat] begona foydalanuvchi: ${kimdan}`);
    return; // begonalarga umuman javob bermaymiz
  }

  // ── buyruqlar ────────────────────────────────────────────────────
  const buyruq = xabar.text?.match(/^\/([a-z]+)/i)?.[1]?.toLowerCase();
  if (buyruq && await buyruqniIshlash(buyruq, { chatId, telegram, daftar, cfg })) return;

  // ── matn yoki ovoz ───────────────────────────────────────────────
  let matn = (xabar.text || xabar.caption || '').trim();
  let manba = 'matn';

  const ovoz = xabar.voice || xabar.audio
    || (xabar.document?.mime_type?.startsWith('audio/') ? xabar.document : null);

  if (ovoz) {
    await telegram.sendChatAction(chatId, 'typing');
    try {
      const fayl = await telegram.faylniYuklash(ovoz.file_id);
      matn = await ovozdanMatn(fayl.buffer, fayl.nom, cfg);
      manba = 'ovoz';
      // eshitganini darrov qaytarib yuboramiz — egasi xatoni shu zahoti ko'rsin
      await telegram.sendMessage(chatId, `\u{1F3A4} <b>Eshitganim:</b>\n<i>${esc(matn)}</i>`);
    } catch (xato) {
      const xabarMatni = xato instanceof OvozXatosi ? xato.message : `Ovozni o‘girib bo‘lmadi: ${xato.message}`;
      await telegram.sendMessage(chatId, `⚠ ${esc(xabarMatni)}`);
      return;
    }
  }

  if (!matn) {
    await telegram.sendMessage(chatId, 'Matn yoki ovozli xabar yuboring. /yordam — misollar.');
    return;
  }

  await telegram.sendChatAction(chatId, 'typing');
  const natija = await agent.javob({ chatId, matn, manba });

  await telegram.sendMessage(chatId, esc(natija.javob));

  for (const tayyor of natija.tayyorMatnlar) await telegram.sendMessage(chatId, tayyor);
  for (const fayl of natija.fayllar) {
    await telegram.sendDocument(chatId, fayl.buffer, fayl.nom, `\u{1F4CA} ${fayl.qatorlar} qator`);
  }

  if (manba === 'ovoz' && natija.yangiYozuvlar.length) {
    await tasdiqSorash(natija.yangiYozuvlar, { chatId, telegram, daftar, cfg });
  }
}

/**
 * Ovozdan yozilgan yozuvlarni ko'rsatib, tasdiq so'raydi.
 * Xabar ID si yozuvga bog'lanadi — muddat o'tganda tugmalar olib tashlanadi.
 */
async function tasdiqSorash(yozuvlar, { chatId, telegram, daftar, cfg }) {
  const kop = yozuvlar.length > 1;
  const qatorlar = [
    `\u{1F4DD} <b>Shu yozuv${kop ? 'lar' : ''} saqlandi:</b>`,
    ...yozuvlar.map((y) => `   • ${esc(qisqaSatr(y))}`),
    '',
    'Noto‘g‘ri bo‘lsa shu yerga tuzatib yozing.',
    `<i>${cfg.tasdiqDaqiqa} daqiqada javob bo‘lmasa, to‘g‘ri deb saqlayman.</i>`,
  ];

  const tugmalarRoyxati = [[{ text: `✅ To‘g‘ri`, callback_data: 't:*' }]];
  for (const y of yozuvlar.slice(0, 5)) {
    tugmalarRoyxati.push([{
      text: `\u{1F5D1} ${y.kim}${kop && y.nima ? ` — ${y.nima}` : ''} o‘chirilsin`.slice(0, 60),
      callback_data: `o:${y.id}`,
    }]);
  }

  const yuborilgan = await telegram.sendMessage(chatId, qatorlar.join('\n'), {
    reply_markup: { inline_keyboard: tugmalarRoyxati },
  });

  for (const y of yozuvlar) {
    daftar.yangilash(y.id, { tasdiqChatId: chatId, tasdiqXabarId: yuborilgan?.message_id ?? null });
  }
}

/** @returns {Promise<boolean>} buyruq tanildimi */
async function buyruqniIshlash(buyruq, { chatId, telegram, daftar, cfg }) {
  const v = hozir(cfg.vaqtMintaqasi);

  switch (buyruq) {
    case 'start':
    case 'yordam':
    case 'help':
      await telegram.sendMessage(chatId, yordamMatni(cfg));
      return true;

    case 'royxat':
      await telegram.sendMessage(chatId, ochiqlarMatni(daftar.yozuvlar, cfg.vaqtMintaqasi));
      return true;

    case 'excel': {
      if (!daftar.yozuvlar.length) {
        await telegram.sendMessage(chatId, 'Daftar hali bo‘sh.');
        return true;
      }
      const fayl = excelTuzish(daftar.yozuvlar, { vaqtMintaqasi: cfg.vaqtMintaqasi });
      await telegram.sendDocument(chatId, fayl.buffer, fayl.nom, `\u{1F4CA} ${fayl.qatorlar} qator`);
      return true;
    }

    case 'oy':
      await telegram.sendMessage(chatId, oylikHisobotMatni(daftar.yozuvlar, v.oyKodi, cfg.vaqtMintaqasi));
      return true;

    case 'otganoy':
      await telegram.sendMessage(
        chatId,
        oylikHisobotMatni(daftar.yozuvlar, oldingiOy(v.oyKodi), cfg.vaqtMintaqasi),
      );
      return true;

    case 'bekor':
      daftar.tarixniTozalash(chatId);
      await telegram.sendMessage(chatId, '\u{1F9F9} Suhbat tarixi tozalandi. Yozuvlar joyida.');
      return true;

    default:
      return false; // buyruq emas — agentga o'tadi
  }
}

/* ------------------------------------------------------------------ */
/* tugmalar                                                            */
/* ------------------------------------------------------------------ */

export async function tugmaniIshlash(sorov, { telegram, daftar, cfg }) {
  if (sorov.from?.id !== cfg.egaId) {
    await telegram.answerCallbackQuery(sorov.id, 'Ruxsat yo‘q');
    return;
  }

  const xom = String(sorov.data || '');
  const ajratgich = xom.indexOf(':');
  const amal = ajratgich === -1 ? '' : xom.slice(0, ajratgich);
  const qiymat = ajratgich === -1 ? '' : xom.slice(ajratgich + 1);
  const chatId = sorov.message?.chat?.id;
  const xabarId = sorov.message?.message_id;

  switch (amal) {
    // eslatmadagi "qaytardi"
    case 'q': {
      const javob = vositaniBajarish(
        'qaytarildi_belgilash',
        { id: qiymat, sana: null, summa: null, izoh: null },
        { daftar, cfg, fayllar: [], tayyorMatnlar: [], yangiYozuvlar: [] },
      );
      await telegram.answerCallbackQuery(sorov.id, javob.ok ? '✅ Belgilandi' : javob.xato.slice(0, 190));
      if (!javob.ok) return;

      // ro'yxatdagi qolgan tugmalarni yangilaymiz
      const bugungi = hozir(cfg.vaqtMintaqasi).sana;
      const qolgan = daftar.yozuvlar.filter(
        (y) => y.holat !== 'qaytarildi' && y.qaytarish_sanasi && y.qaytarish_sanasi <= bugungi,
      );
      await telegram.editMessageReplyMarkup(chatId, xabarId, tugmalar(qolgan));
      await telegram.sendMessage(chatId, esc(javob.xabar));
      return;
    }

    // ovozdan yozilganini tasdiqlash
    case 't': {
      const yozuvlar = qiymat === '*' ? daftar.kutilayotganlar() : [daftar.topish(qiymat)].filter(Boolean);
      const tasdiqlangan = yozuvlar.map((y) => daftar.tasdiqlash(y.id)).filter(Boolean);

      await telegram.answerCallbackQuery(
        sorov.id,
        tasdiqlangan.length ? `✅ ${tasdiqlangan.length} ta yozuv tasdiqlandi` : 'Allaqachon tasdiqlangan',
      );
      await telegram.editMessageReplyMarkup(chatId, xabarId);
      return;
    }

    // noto'g'ri eshitilgan yozuvni o'chirish
    case 'o': {
      const javob = vositaniBajarish(
        'yozuvni_ochirish',
        { id: qiymat },
        { daftar, cfg, fayllar: [], tayyorMatnlar: [], yangiYozuvlar: [] },
      );
      await telegram.answerCallbackQuery(sorov.id, javob.ok ? '\u{1F5D1} O‘chirildi' : javob.xato.slice(0, 190));
      if (javob.ok) {
        await telegram.editMessageReplyMarkup(chatId, xabarId);
        await telegram.sendMessage(chatId, `${esc(javob.xabar)}\n\nTo‘g‘risini yozib yuboring.`);
      }
      return;
    }

    default:
      await telegram.answerCallbackQuery(sorov.id, 'Tanilmagan tugma');
  }
}

// faqat to'g'ridan-to'g'ri ishga tushirilganda startlaydi — sinovlar import qila olsin
const buFayl = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === buFayl) {
  asosiy().catch((xato) => {
    console.error('Kutilmagan xato:', xato);
    process.exit(1);
  });
}
