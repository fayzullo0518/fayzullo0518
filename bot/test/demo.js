/**
 * Demo — "npm run demo".
 *
 * Haqiqiy botni (src/index.js) alohida jarayon sifatida ishga tushiradi, lekin
 * Telegram, DeepSeek va ovoz xizmatlari o'rniga shu fayldagi soxta server
 * turadi. Ya'ni butun zanjir — long polling, xabar qabul qilish, vositalar
 * sikli, tasdiqlash oqimi, tugmalar, Excel, eslatma — chinakamiga ishlaydi,
 * faqat tashqariga chiqmaydi. Internet ham, pul ham ketmaydi.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ILDIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'demo';
const EGA = 7;
const papka = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-demo-'));
const BAZA = path.join(papka, 'daftar.json');

/* ================================================================== */
/* boshlang'ich baza — muddati o'tgan bitta yozuv bilan                */
/* ================================================================== */

fs.writeFileSync(BAZA, JSON.stringify({
  versiya: 1,
  ketmaKet: 1,
  yozuvlar: [{
    id: 'Y0001', turi: 'pul_qarz', kim: 'Bek', nima: null, summa: 2000000,
    valyuta: 'UZS', berilgan_sana: '2026-08-20', qaytarish_sanasi: '2026-09-10',
    izoh: null, holat: 'ochiq', qaytarilgan_sana: null, qaytarilgan_summa: 0,
    manba: 'matn', asl_matn: null, eslatilgan: [],
    tasdiq: 'tasdiqlangan', tasdiqMuddati: null, tasdiqChatId: null, tasdiqXabarId: null,
    yaratilgan: '2026-08-20T09:00:00.000Z', yangilangan: '2026-08-20T09:00:00.000Z',
  }],
  suhbat: {},
  holat: { oxirgiKunlikEslatma: null, oxirgiOylikHisobot: '2026-08' },
}, null, 2));

/* ================================================================== */
/* soxta xizmatlar                                                     */
/* ================================================================== */

const navbat = [];          // botga beriladigan yangilanishlar
const chat = [];            // bot yuborgan hamma narsa
const llmNavbati = [];      // soxta DeepSeek javoblari
let transkript = '';        // soxta ASR nima "eshitadi"
let xabarRaqami = 100;
let yangilanishRaqami = 1;

const tanaOqish = (sorov) => new Promise((yechim) => {
  const bolaklar = [];
  sorov.on('data', (b) => bolaklar.push(b));
  sorov.on('end', () => yechim(Buffer.concat(bolaklar)));
});

const jsonJavob = (javob, tana) => {
  javob.writeHead(200, { 'content-type': 'application/json' });
  javob.end(JSON.stringify(tana));
};

const server = http.createServer(async (sorov, javob) => {
  const yol = sorov.url.split('?')[0];
  const xom = await tanaOqish(sorov);

  // ── ovozli xabar fayli ─────────────────────────────────────────────
  if (yol === `/file/bot${TOKEN}/voice/demo.oga`) {
    javob.writeHead(200, { 'content-type': 'audio/ogg' });
    javob.end(Buffer.from('OggS soxta audio'));
    return;
  }

  // ── soxta ASR ──────────────────────────────────────────────────────
  if (yol === '/v1/audio/transcriptions') {
    jsonJavob(javob, { text: transkript });
    return;
  }

  // ── soxta DeepSeek ─────────────────────────────────────────────────
  if (yol === '/chat/completions') {
    // matn tozalash chaqiruvi - sahna navbatini yemasligi kerak
    const sorovTanasi = JSON.parse(xom.toString('utf8'));
    const tizim = sorovTanasi.messages?.find((x) => x.role === 'system')?.content || '';
    if (/transkriptini tuzatuvchisan/.test(tizim)) {
      const oxirgi = sorovTanasi.messages.at(-1).content.replace(/^[\s\S]*Matn:\s*/, '');
      jsonJavob(javob, { choices: [{ message: { role: 'assistant', content: oxirgi }, finish_reason: 'stop' }] });
      return;
    }

    const keyingi = llmNavbati.shift();
    if (!keyingi) {
      jsonJavob(javob, { choices: [{ message: { role: 'assistant', content: 'Tayyor.' }, finish_reason: 'stop' }] });
      return;
    }
    jsonJavob(javob, keyingi);
    return;
  }

  // ── soxta Telegram ─────────────────────────────────────────────────
  const metod = yol.startsWith(`/bot${TOKEN}/`) ? yol.slice(`/bot${TOKEN}/`.length) : '';
  const tana = xom.length && sorov.headers['content-type']?.includes('json') ? JSON.parse(xom) : {};

  switch (metod) {
    case 'getMe':
      return jsonJavob(javob, { ok: true, result: { id: 1, username: 'demo_daftar_bot', first_name: 'Daftar' } });

    case 'setMyCommands':
    case 'sendChatAction':
      return jsonJavob(javob, { ok: true, result: true });

    case 'getUpdates': {
      // bo'sh bo'lsa biroz kutamiz — haqiqiy long polling kabi, lekin qisqa
      const boshlandi = Date.now();
      while (!navbat.length && Date.now() - boshlandi < 700) {
        await new Promise((y) => { setTimeout(y, 40); });
      }
      const berish = navbat.splice(0, navbat.length);
      return jsonJavob(javob, { ok: true, result: berish });
    }

    case 'sendMessage': {
      xabarRaqami += 1;
      chat.push({
        tur: 'xabar',
        matn: tana.text,
        tugmalar: tana.reply_markup?.inline_keyboard || null,
        xabarId: xabarRaqami,
      });
      return jsonJavob(javob, { ok: true, result: { message_id: xabarRaqami } });
    }

    case 'sendDocument': {
      const nom = String(xom).match(/filename="([^"]+)"/)?.[1] || '(nomsiz)';
      xabarRaqami += 1;
      chat.push({ tur: 'fayl', nom, hajm: xom.length, xabarId: xabarRaqami });
      return jsonJavob(javob, { ok: true, result: { message_id: xabarRaqami } });
    }

    case 'answerCallbackQuery':
      chat.push({ tur: 'tugmaJavobi', matn: tana.text });
      return jsonJavob(javob, { ok: true, result: true });

    case 'editMessageReplyMarkup':
      chat.push({ tur: 'tugmaTahriri', xabarId: tana.message_id });
      return jsonJavob(javob, { ok: true, result: true });

    case 'getFile':
      return jsonJavob(javob, { ok: true, result: { file_id: tana.file_id, file_path: 'voice/demo.oga' } });

    default:
      return jsonJavob(javob, { ok: false, description: `soxta serverda yo‘q: ${metod}` });
  }
});

/* ================================================================== */
/* yordamchilar                                                        */
/* ================================================================== */

const kut = (ms) => new Promise((y) => { setTimeout(y, ms); });

const vositaJavobi = (nom, kirish) => ({
  choices: [{
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: `call_${Math.random().toString(36).slice(2, 8)}`, type: 'function', function: { name: nom, arguments: JSON.stringify(kirish) } }],
    },
    finish_reason: 'tool_calls',
  }],
});

const matnJavobi = (matn) => ({
  choices: [{ message: { role: 'assistant', content: matn }, finish_reason: 'stop' }],
});

function matnYubor(matn) {
  yangilanishRaqami += 1;
  navbat.push({
    update_id: yangilanishRaqami,
    message: { message_id: yangilanishRaqami, from: { id: EGA }, chat: { id: EGA }, text: matn },
  });
}

function ovozYubor(eshitiladigan) {
  transkript = eshitiladigan;
  yangilanishRaqami += 1;
  navbat.push({
    update_id: yangilanishRaqami,
    message: {
      message_id: yangilanishRaqami, from: { id: EGA }, chat: { id: EGA },
      voice: { file_id: 'voice_1', duration: 6, mime_type: 'audio/ogg' },
    },
  });
}

function tugmaBos(data, xabarId) {
  yangilanishRaqami += 1;
  navbat.push({
    update_id: yangilanishRaqami,
    callback_query: {
      id: `cb_${yangilanishRaqami}`, from: { id: EGA }, data,
      message: { message_id: xabarId, chat: { id: EGA } },
    },
  });
}

/** Bot tinchiguncha kutadi (yangi xabar kelmay qolguncha) */
async function jimlikniKut({ jimlik = 900, chegara = 25000 } = {}) {
  const boshlandi = Date.now();
  let oxirgi = chat.length;
  let oxirgiOzgarish = Date.now();
  while (Date.now() - boshlandi < chegara) {
    await kut(120);
    if (chat.length !== oxirgi) {
      oxirgi = chat.length;
      oxirgiOzgarish = Date.now();
    } else if (Date.now() - oxirgiOzgarish >= jimlik) {
      return;
    }
  }
}

/** Oxirgi marta ko'rsatilgan joydan keyingi xabarlarni chop etadi */
let korsatilgan = 0;
function chop(sarlavha) {
  if (sarlavha) console.log(`\n── ${sarlavha} ${'─'.repeat(Math.max(0, 58 - sarlavha.length))}`);
  for (const q of chat.slice(korsatilgan)) {
    if (q.tur === 'xabar') {
      const qatorlar = String(q.matn).replace(/<[^>]+>/g, '').split('\n');
      console.log(`  \u{1F916} ${qatorlar[0]}`);
      for (const qator of qatorlar.slice(1)) console.log(`     ${qator}`);
      if (q.tugmalar) {
        const tugmalar = q.tugmalar.map(([t]) => `[ ${t.text} ]`).join('  ');
        console.log(`     ${tugmalar}`);
      }
    } else if (q.tur === 'fayl') {
      console.log(`  \u{1F916} \u{1F4CE} ${q.nom} (${(q.hajm / 1024).toFixed(1)} KB)`);
    } else if (q.tur === 'tugmaJavobi') {
      console.log(`  \u{1F4A1} ${q.matn}`);
    }
  }
  korsatilgan = chat.length;
}

const siz = (matn) => console.log(`  \u{1F464} ${matn}`);

/* ================================================================== */
/* demo                                                                */
/* ================================================================== */

const port = await new Promise((yechim) => {
  server.listen(0, '127.0.0.1', () => yechim(server.address().port));
});
const asos = `http://127.0.0.1:${port}`;

const bola = spawn(process.execPath, [path.join(ILDIZ, 'src', 'index.js')], {
  cwd: ILDIZ,
  env: {
    ...process.env,
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_ASOS: asos,
    DEEPSEEK_API_KEY: 'demo',
    DEEPSEEK_ASOS: asos,
    LLM_XIZMATI: 'deepseek',
    LLM_MODEL: 'deepseek-chat',
    OPENAI_API_KEY: 'demo',
    ASR_ASOS: asos,
    ANTHROPIC_API_KEY: '',
    OWNER_ID: String(EGA),
    BAZA_YOLI: BAZA,
    TASDIQ_DAQIQA: '0.1',      // 6 soniya — demoda 10 daqiqa kutib bo'lmaydi
    TEKSHIRUV_SONIYA: '2',
    ESLATMA_SOATI: '0',
    TIMEZONE: 'Asia/Tashkent',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const botLog = [];
bola.stdout.on('data', (b) => botLog.push(String(b)));
bola.stderr.on('data', (b) => botLog.push(String(b)));

const tugat = (kod) => {
  bola.kill('SIGTERM');
  server.close();
  fs.rmSync(papka, { recursive: true, force: true });
  process.exit(kod);
};

try {
  console.log('\n\u{1F680} Bot ishga tushirilmoqda (soxta Telegram + soxta DeepSeek)…');
  await kut(2500);
  console.log(botLog.join('').trimEnd().split('\n').map((q) => `  ${q}`).join('\n'));

  /* 1. ishga tushganda muddati o'tgan qarzni eslatadi ---------------- */
  await jimlikniKut({ jimlik: 700 });
  chop('1. Ishga tushdi — muddati o‘tganini o‘zi eslatdi');

  const eslatma = chat.find((q) => q.tugmalar?.some(([t]) => t.callback_data?.startsWith('q:')));
  assert.ok(eslatma, 'eslatma xabari kelmadi');

  /* 2. "qaytardi" tugmasi ------------------------------------------- */
  console.log('');
  siz('[ ✅ Bek tugmasini bosdi ]');
  tugmaBos(eslatma.tugmalar[0][0].callback_data, eslatma.xabarId);
  await jimlikniKut({ jimlik: 700 });
  chop('2. Tugma bosildi');

  /* 3. yozma xabar --------------------------------------------------- */
  const matn1 = 'Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to‘laydi';
  llmNavbati.push(
    vositaJavobi('yozuv_qoshish', {
      turi: 'apparat_qarz', kim: 'Sardor', nima: 'UZI apparati', summa: 12000000,
      valyuta: 'UZS', berilgan_sana: '2026-09-15', qaytarish_sanasi: '2026-10-01', izoh: null,
    }),
    matnJavobi('Saqladim: Sardor — UZI apparati, 12 000 000 so‘m, 1-oktabrgacha.'),
  );
  console.log('');
  siz(matn1);
  matnYubor(matn1);
  await jimlikniKut();
  chop('3. Yozma xabar — darrov saqlandi, tasdiq so‘ralmaydi');

  /* 4. ovozli xabar -------------------------------------------------- */
  llmNavbati.push(
    vositaJavobi('yozuv_qoshish', {
      turi: 'pul_qarz', kim: 'Akmal', nima: null, summa: 5000000,
      valyuta: 'UZS', berilgan_sana: '2026-09-15', qaytarish_sanasi: '2026-09-30', izoh: null,
    }),
    matnJavobi('Saqladim: Akmal — 5 000 000 so‘m, 30-sentabrgacha.'),
  );
  console.log('');
  siz('\u{1F3A4} [ovozli xabar]');
  ovozYubor('Akmalga besh million qarz berdim o‘ttiz sentabrda qaytaradi');
  await jimlikniKut();
  chop('4. Ovozli xabar — eshitgani qaytarildi va tasdiq so‘raldi');

  const tasdiq = chat.find((q) => q.tugmalar?.some(([t]) => t.callback_data === 't:*'));
  assert.ok(tasdiq, 'tasdiq xabari kelmadi');

  /* 5. "To'g'ri" tugmasi --------------------------------------------- */
  console.log('');
  siz('[ ✅ To‘g‘ri tugmasini bosdi ]');
  tugmaBos('t:*', tasdiq.xabarId);
  await jimlikniKut({ jimlik: 700 });
  chop('5. Darhol tasdiqlandi');

  /* 6. ovoz + jim qolish -> o'zi tasdiqlanadi ------------------------ */
  llmNavbati.push(
    vositaJavobi('yozuv_qoshish', {
      turi: 'apparat_ijara', kim: 'Jasur', nima: 'Kardiograf', summa: null,
      valyuta: 'UZS', berilgan_sana: '2026-09-15', qaytarish_sanasi: '2026-10-05', izoh: null,
    }),
    matnJavobi('Saqladim: Jasur — Kardiograf, 5-oktabrgacha.'),
  );
  console.log('');
  siz('\u{1F3A4} [ovozli xabar]');
  ovozYubor('Jasurga kardiograf berdim yigirma kundan keyin qaytaradi');
  await jimlikniKut();
  chop('6. Yana ovoz — bu safar javob bermaymiz');

  console.log('\n  ⏳ Jim turamiz… (demoda 6 soniya, haqiqatda 10 daqiqa)');
  await kut(9000);
  chop('   Muddat o‘tdi — tugmalar olindi, yozuv to‘g‘ri deb tasdiqlandi');

  /* 7. ro'yxat va Excel ---------------------------------------------- */
  console.log('');
  siz('/royxat');
  matnYubor('/royxat');
  await jimlikniKut({ jimlik: 700 });
  chop('7. Qaytarilmaganlar ro‘yxati');

  console.log('');
  siz('/excel');
  matnYubor('/excel');
  await jimlikniKut({ jimlik: 700 });
  chop('8. Excel fayl');

  /* ── tekshiruvlar ─────────────────────────────────────────────────── */
  const baza = JSON.parse(fs.readFileSync(BAZA, 'utf8'));
  const topish = (kim) => baza.yozuvlar.find((y) => y.kim === kim);

  assert.equal(baza.yozuvlar.length, 4, 'to‘rtta yozuv bo‘lishi kerak');
  assert.equal(topish('Bek').holat, 'qaytarildi', 'Bek tugma orqali yopilishi kerak edi');
  assert.equal(topish('Sardor').tasdiq, 'tasdiqlangan', 'yozma xabar darrov tasdiqlanadi');
  assert.equal(topish('Akmal').tasdiq, 'tasdiqlangan', 'tugma bilan tasdiqlandi');
  assert.equal(topish('Jasur').tasdiq, 'tasdiqlangan', 'jim qolingani uchun tasdiqlandi');
  assert.equal(topish('Jasur').manba, 'ovoz');
  assert.ok(chat.some((q) => q.tur === 'fayl' && q.nom.endsWith('.xlsx')), 'Excel yuborilmadi');
  assert.ok(chat.some((q) => q.tur === 'xabar' && /Eshitganim/.test(q.matn)), 'transkript qaytarilmadi');

  console.log('\n✅ Demo to‘liq o‘tdi — 4 yozuv, tugmalar, tasdiqlash, Excel: hammasi ishladi.\n');
  tugat(0);
} catch (xato) {
  console.error(`\n❌ Demo xatosi: ${xato.message}`);
  console.error('\n── bot logi ──');
  console.error(botLog.join(''));
  tugat(1);
}
