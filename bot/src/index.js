/**
 * Botning kirish nuqtasi — hamma qismlarni bog'laydi va yangilanishlarni
 * long polling orqali qabul qiladi.
 */
import { sozlamalar } from './config.js';
import { Daftar } from './store.js';
import { Telegram, esc } from './telegram.js';
import { Agent, agentXatosi } from './agent.js';
import { ovozdanMatn, OvozXatosi } from './asr.js';
import { eslatmaniBoshlash } from './eslatma.js';
import { excelTuzish, oylikHisobotMatni, ochiqlarMatni } from './hisobot.js';
import { vositaniBajarish } from './vositalar.js';
import { hozir, oldingiOy } from './vaqt.js';

const BUYRUQLAR = [
  { command: 'royxat', description: 'Qaytarilmaganlar ro‘yxati' },
  { command: 'excel', description: 'Excel hisobot yuborish' },
  { command: 'oy', description: 'Shu oy bo‘yicha hisobot' },
  { command: 'otganoy', description: 'O‘tgan oy bo‘yicha hisobot' },
  { command: 'bekor', description: 'Suhbat tarixini tozalash' },
  { command: 'id', description: 'Telegram ID ni ko‘rsatish' },
  { command: 'yordam', description: 'Qanday ishlashi haqida' },
];

const YORDAM = `\u{1F4D2} <b>Daftar bot</b>

Menga oddiy qilib yozing yoki ovozli xabar yuboring — o‘zim tushunib yozib qo‘yaman.

<b>Misollar:</b>
• "Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to‘laydi"
• "Jasurga kardiograf vaqtincha berdim, 20 kundan keyin qaytaradi"
• "Akmalga 5 mln qarz berdim, oyning oxirida qaytaradi"
• "Sardor qaytardi" — yozuvni yopaman
• "Akmal 2 mln berdi" — qisman to‘lov qilib belgilayman

<b>Buyruqlar:</b>
/royxat — qaytarilmaganlar
/excel — Excel fayl (3 varaq: hammasi, qaytarilmagan, qaytarilgan)
/oy — shu oy hisoboti
/otganoy — o‘tgan oy hisoboti
/bekor — suhbat tarixini tozalash

Har kuni belgilangan soatda muddati kelganlarni eslataman,
har oy boshida esa o‘tgan oy yakunini yuboraman.`;

async function asosiy() {
  let cfg;
  try {
    cfg = sozlamalar();
  } catch (xato) {
    console.error(`\n❌ ${xato.message}\n`);
    process.exit(1);
  }

  const daftar = new Daftar(cfg.bazaYoli);
  const telegram = new Telegram(cfg.token);
  const agent = new Agent(cfg, daftar);

  const men = await telegram.chaqir('getMe').catch((xato) => {
    console.error(`\n❌ Telegramga ulanib bo‘lmadi: ${xato.message}\n`);
    process.exit(1);
  });

  await telegram.setMyCommands(BUYRUQLAR);

  console.log(`✅ @${men.username} ishga tushdi`);
  console.log(`   Baza:        ${cfg.bazaYoli} (${daftar.yozuvlar.length} yozuv)`);
  console.log(`   Model:       ${cfg.model}${cfg.effort ? ` (effort: ${cfg.effort})` : ''}`);
  console.log(`   Vaqt:        ${cfg.vaqtMintaqasi}, eslatma soat ${cfg.eslatmaSoati}:00`);
  console.log(`   Ovoz:        ${cfg.asr === 'yoq' ? 'o‘chirilgan (kalit yo‘q)' : cfg.asr}`);
  console.log(`   Ega:         ${cfg.egaId || 'BELGILANMAGAN — botga /id yozing'}`);

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
  let toxtatildi = false;

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log('\n\u{1F44B} To‘xtatilmoqda…');
      toxtatildi = true;
      process.exit(0);
    });
  }

  while (!toxtatildi) {
    let yangilanishlar;
    try {
      yangilanishlar = await telegram.getUpdates(offset);
      kechikish = 1000;
    } catch (xato) {
      if (xato.kod === 409) {
        console.error('❌ Bu bot boshqa joyda ham ishlayapti. Eski nusxasini to‘xtating.');
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
          await telegram
            .sendMessage(chatId, `⚠ ${esc(agentXatosi(xato))}`)
            .catch(() => null);
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
  if (buyruq) {
    const bajarildi = await buyruqniIshlash(buyruq, { chatId, telegram, daftar, cfg });
    if (bajarildi) return;
  }

  // ── matn yoki ovoz ───────────────────────────────────────────────
  let matn = (xabar.text || xabar.caption || '').trim();
  let manba = 'matn';

  const ovoz = xabar.voice || xabar.audio || (xabar.document?.mime_type?.startsWith('audio/') ? xabar.document : null);
  if (ovoz) {
    await telegram.sendChatAction(chatId, 'typing');
    try {
      const fayl = await telegram.faylniYuklash(ovoz.file_id);
      matn = await ovozdanMatn(fayl.buffer, fayl.nom, cfg);
      manba = 'ovoz';
      await telegram.sendMessage(chatId, `\u{1F3A4} <i>${esc(matn)}</i>`);
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

  for (const tayyor of natija.tayyorMatnlar) {
    await telegram.sendMessage(chatId, tayyor);
  }
  for (const fayl of natija.fayllar) {
    await telegram.sendDocument(chatId, fayl.buffer, fayl.nom, `\u{1F4CA} ${fayl.qatorlar} qator`);
  }
}

/** @returns {Promise<boolean>} buyruq tanildimi */
async function buyruqniIshlash(buyruq, { chatId, telegram, daftar, cfg }) {
  const v = hozir(cfg.vaqtMintaqasi);

  switch (buyruq) {
    case 'start':
    case 'yordam':
    case 'help':
      await telegram.sendMessage(chatId, YORDAM);
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
/* eslatmadagi "qaytardi" tugmasi                                      */
/* ------------------------------------------------------------------ */

async function tugmaniIshlash(sorov, { telegram, daftar, cfg }) {
  if (sorov.from?.id !== cfg.egaId) {
    await telegram.answerCallbackQuery(sorov.id, 'Ruxsat yo‘q');
    return;
  }

  const [amal, id] = String(sorov.data || '').split(':');
  if (amal !== 'q' || !id) {
    await telegram.answerCallbackQuery(sorov.id, 'Tanilmagan tugma');
    return;
  }

  const javob = vositaniBajarish(
    'qaytarildi_belgilash',
    { id, sana: null, summa: null, izoh: null },
    { daftar, cfg, fayllar: [], tayyorMatnlar: [] },
  );

  await telegram.answerCallbackQuery(sorov.id, javob.ok ? '✅ Belgilandi' : javob.xato.slice(0, 190));

  if (javob.ok) {
    const qolgan = daftar.yozuvlar.filter(
      (y) => y.holat !== 'qaytarildi' && y.qaytarish_sanasi && y.qaytarish_sanasi <= hozir(cfg.vaqtMintaqasi).sana,
    );
    await telegram.editMessageReplyMarkup(sorov.message.chat.id, sorov.message.message_id, {
      inline_keyboard: qolgan.slice(0, 20).map((y) => [
        { text: `✅ ${y.kim}${y.nima ? ` — ${y.nima}` : ''}`.slice(0, 60), callback_data: `q:${y.id}` },
      ]),
    });
    await telegram.sendMessage(sorov.message.chat.id, esc(javob.xabar));
  }
}

asosiy().catch((xato) => {
  console.error('❌ Kutilmagan xato:', xato);
  process.exit(1);
});
