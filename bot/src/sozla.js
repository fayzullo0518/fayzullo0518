/**
 * Sozlash ustasi — "npm run sozla".
 *
 * .env faylini savol-javob orqali yaratadi. Notepad yoki nano ochish,
 * fayl nomini to'g'ri qo'yish bilan ovora bo'lmaysiz.
 * Windows, Mac va Linux'da bir xil ishlaydi.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as kirish, stdout as chiqish } from 'node:process';

import { ROOT } from './config.js';

const ENV_YOLI = path.join(ROOT, '.env');
const ESC = String.fromCharCode(27);
const RANGLI = chiqish.isTTY && process.env.NO_COLOR === undefined;
const bo = (kod) => (m) => (RANGLI ? `${ESC}[${kod}m${m}${ESC}[0m` : String(m));
const kul = bo(90);
const qalin = bo(1);
const yashil = bo(32);
const sariq = bo(33);

class BekorQilindi extends Error {}

const yashir = (q) => (q && q.length > 12 ? `${q.slice(0, 6)}…${q.slice(-4)}` : q || '');

/** Mavjud .env ni o'qiydi (oddiy KALIT=qiymat) */
function borniOqish() {
  if (!fs.existsSync(ENV_YOLI)) return {};
  const natija = {};
  for (const qator of fs.readFileSync(ENV_YOLI, 'utf8').split(/\r?\n/)) {
    const mos = qator.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (mos) natija[mos[1]] = mos[2].trim().replace(/^["']|["']$/g, '');
  }
  return natija;
}

const MAYDONLAR = [
  {
    kalit: 'DEEPSEEK_API_KEY',
    savol: 'DeepSeek kaliti',
    izoh: 'platform.deepseek.com → API keys.  sk-... bilan boshlanadi.',
    shart: true,
    tekshir: (q) => (q.startsWith('sk-') ? null : 'Kalit "sk-" bilan boshlanishi kerak.'),
  },
  {
    kalit: 'TELEGRAM_BOT_TOKEN',
    savol: 'Telegram bot tokeni',
    izoh: '@BotFather → /newbot.  Faqat terminalda sinamoqchi bo‘lsangiz, bo‘sh qoldiring.',
    shart: false,
    tekshir: (q) => (/^\d+:[A-Za-z0-9_-]+$/.test(q) ? null : 'Token "123456789:AA..." ko‘rinishida bo‘ladi.'),
  },
  {
    kalit: 'OWNER_ID',
    savol: 'Telegram ID raqamingiz',
    izoh: 'Bilmasangiz bo‘sh qoldiring — botga /id yozib keyin qo‘yasiz.',
    shart: false,
    tekshir: (q) => (/^\d+$/.test(q) ? null : 'Faqat raqam bo‘lishi kerak.'),
  },
  {
    kalit: 'OVOZ_KALITI',
    savol: 'Ovozli xabar uchun kalit',
    izoh: 'Groq (bepul limiti bor): console.groq.com -> gsk_...\n'
      + '   Yoki OpenAI (pullik): platform.openai.com -> sk-...\n'
      + "   Ovoz kerak bo'lmasa bo'sh qoldiring, yozma xabarlar baribir ishlaydi.",
    shart: false,
    tekshir: (q) => (/^(sk-|gsk_)/.test(q)
      ? null
      : 'Groq kaliti "gsk_", OpenAI kaliti "sk-" bilan boshlanadi.'),
  },
];

const QOLGANI = {
  LLM_XIZMATI: 'deepseek',
  LLM_MODEL: 'deepseek-chat',
  TIMEZONE: 'Asia/Tashkent',
  ESLATMA_SOATI: '9',
  TASDIQ_DAQIQA: '10',
  VALYUTA: 'UZS',
};

async function asosiy() {
  console.log(`\n${qalin('\u{1F527} Daftar — sozlash')}`);
  console.log(kul(`   Fayl: ${ENV_YOLI}`));

  const bor = borniOqish();
  // ovoz kaliti ikki nom ostida bo'lishi mumkin - bittasiga jamlaymiz
  bor.OVOZ_KALITI = bor.GROQ_API_KEY || bor.OPENAI_API_KEY || '';
  if (Object.keys(bor).length) {
    console.log(kul('   Mavjud .env topildi — o‘zgartirmaslik uchun Enter bosing.'));
  }
  console.log(kul('   Bekor qilish: Ctrl+C\n'));

  const rl = readline.createInterface({
    input: kirish,
    output: chiqish,
    terminal: Boolean(chiqish.isTTY),
  });
  // async iterator quvur (pipe) bilan ham, klaviatura bilan ham bir xil ishlaydi
  // va kirish tugaganini (EOF) aniq bildiradi
  const qatorlar = rl[Symbol.asyncIterator]();

  const sora = async (belgi) => {
    chiqish.write(belgi);
    const { value, done } = await qatorlar.next();
    if (done) throw new BekorQilindi();
    return String(value);
  };

  const qiymatlar = { ...QOLGANI, ...bor };

  try {
    for (const maydon of MAYDONLAR) {
      const hozirgi = bor[maydon.kalit] || '';
      console.log(qalin(maydon.savol) + (maydon.shart ? '' : kul('  (ixtiyoriy)')));
      console.log(kul(`   ${maydon.izoh}`));
      if (hozirgi) console.log(kul(`   Hozirgi: ${yashir(hozirgi)}`));

      for (;;) {
        const javob = (await sora('   > ')).trim();

        if (!javob) {
          if (hozirgi) { qiymatlar[maydon.kalit] = hozirgi; break; }
          if (!maydon.shart) { qiymatlar[maydon.kalit] = ''; break; }
          console.log(sariq('   Bu maydon majburiy.'));
          continue;
        }

        const xato = maydon.tekshir(javob);
        if (xato) { console.log(sariq(`   ${xato}`)); continue; }

        qiymatlar[maydon.kalit] = javob;
        break;
      }
      console.log('');
    }
  } finally {
    rl.close();
  }

  yozish(qiymatlar);

  console.log(yashil(`✅ Saqlandi: ${ENV_YOLI}\n`));
  console.log(qalin('Keyingi qadam:'));

  if (qiymatlar.TELEGRAM_BOT_TOKEN) {
    console.log('  npm run tekshir    ' + kul('hamma xizmat ishlayaptimi'));
    console.log('  npm start          ' + kul('Telegram botini ishga tushirish'));
    if (!qiymatlar.OWNER_ID) {
      console.log(kul('\n  OWNER_ID bo‘sh: botga /id yozing, keyin "npm run sozla" ni qayta ishlating.'));
    }
  } else {
    console.log('  npm run chat       ' + kul('terminalda sinab ko‘rish (Telegram kerak emas)'));
    console.log(kul('\n  Telegram boti kerak bo‘lsa, "npm run sozla" ni qayta ishlatib token qo‘shing.'));
  }
  console.log('');
}

function yozish(qiymatlar) {
  // gsk_ -> Groq, sk- -> OpenAI; kod qaysi biri borligiga qarab o'zi tanlaydi
  const ovoz = qiymatlar.OVOZ_KALITI || '';
  qiymatlar.GROQ_API_KEY = ovoz.startsWith('gsk_') ? ovoz : '';
  qiymatlar.OPENAI_API_KEY = ovoz.startsWith('sk-') ? ovoz : '';

  const qator = (k) => `${k}=${qiymatlar[k] ?? ''}`;
  const matn = [
    '# Daftar bot sozlamalari - "npm run sozla" yaratdi',
    '# Bu faylda maxfiy kalitlar bor. Hech kimga bermang, git ga qo\'ymang.',
    '',
    '# --- til modeli ---',
    qator('DEEPSEEK_API_KEY'),
    qator('LLM_XIZMATI'),
    qator('LLM_MODEL'),
    '# Claude ishlatmoqchi bo\'lsangiz: LLM_XIZMATI=claude va ANTHROPIC_API_KEY=sk-ant-...',
    '',
    '# --- Telegram (terminal rejimi uchun kerak emas) ---',
    qator('TELEGRAM_BOT_TOKEN'),
    qator('OWNER_ID'),
    '',
    '# --- ovozli xabar (bittasi yetarli) ---',
    '# Groq, bepul limiti bilan:  console.groq.com',
    qator('GROQ_API_KEY'),
    '# OpenAI Whisper, pullik:    platform.openai.com',
    qator('OPENAI_API_KEY'),
    '# Deepgram:                  console.deepgram.com',
    qator('DEEPGRAM_API_KEY'),
    '',
    '# --- qolgan sozlamalar ---',
    qator('TIMEZONE'),
    qator('ESLATMA_SOATI'),
    qator('TASDIQ_DAQIQA'),
    qator('VALYUTA'),
    '',
  ].join('\n');

  fs.writeFileSync(ENV_YOLI, matn, 'utf8');
  try {
    fs.chmodSync(ENV_YOLI, 0o600);   // Windows'da ta'sir qilmaydi, lekin zarari ham yo'q
  } catch { /* ruxsat bo'lmasa jim qolamiz */ }
}

asosiy().catch((xato) => {
  if (xato instanceof BekorQilindi || xato?.code === 'ABORT_ERR') {
    console.log(sariq('\n\nBekor qilindi - .env o\'zgarmadi.'));
    console.log(kul('Qayta urinish:  npm run sozla\n'));
    process.exit(1);
  }
  console.error(`\n${xato.message}\n`);
  process.exit(1);
});
