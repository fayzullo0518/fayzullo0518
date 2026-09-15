/**
 * Diagnostika — "npm run tekshir".
 *
 * Har bir xizmatni alohida sinab ko'radi va nima ishlayotganini, nima
 * ishlamayotganini aniq aytadi. Botni ishga tushirishdan oldin shuni
 * ishlatgan ma'qul.
 */
import { sozlamalar } from '../src/config.js';
import { Telegram } from '../src/telegram.js';
import { miyaYaratish } from '../src/miya.js';
import { Daftar } from '../src/store.js';
import { hozir } from '../src/vaqt.js';

const OK = '✅';
const XATO = '❌';
const OGOH = '⚠️';

const yashir = (kalit) =>
  !kalit ? '(yo‘q)' : `${kalit.slice(0, 6)}…${kalit.slice(-4)} (${kalit.length} belgi)`;

let muammo = 0;

/* 0. papka o'rni --------------------------------------------------- */
// Windows'da PowerShell'ni administrator sifatida ochib git clone qilsangiz,
// loyiha System32 ichiga tushib qoladi. U yerda ishlatib bo'lmaydi.
const ILDIZ = process.cwd();
const tizimPapkasi = /[\\/](System32|SysWOW64)[\\/]/i.test(ILDIZ)
  || /[\\/]Program Files/i.test(ILDIZ);

console.log('\n\u{1F50E} Daftar bot — tekshiruv\n');

if (tizimPapkasi) {
  console.log(`${XATO} Loyiha tizim papkasida turibdi:`);
  console.log(`     ${ILDIZ}`);
  console.log("     Bu yerda ishlatib bo'lmaydi. Oddiy papkaga ko'chiring:");
  console.log('       cd $HOME');
  console.log('       git clone -b claude/agent-tariff-settings-m5z91j \\');
  console.log('         https://github.com/fayzullo0518/fayzullo0518 daftar-bot');
  console.log('       cd daftar-bot/bot');
  console.log('');
  muammo += 1;
}

/* 1. sozlamalar ---------------------------------------------------- */
let cfg;
try {
  cfg = sozlamalar();
  console.log(`${OK} .env o‘qildi`);
  console.log(`     Telegram token:  ${yashir(cfg.token)}`);
  console.log(`     Model:           ${cfg.xizmat} / ${cfg.model}`);
  console.log(`     ${cfg.xizmat === 'deepseek' ? 'DeepSeek' : 'Anthropic'} kalit: ${yashir(cfg.xizmat === 'deepseek' ? cfg.deepseekKalit : cfg.anthropicKalit)}`);
  console.log(`     Vaqt mintaqasi:  ${cfg.vaqtMintaqasi} (hozir ${hozir(cfg.vaqtMintaqasi).sana}, soat ${hozir(cfg.vaqtMintaqasi).soat})`);
  console.log(`     Eslatma soati:   ${cfg.eslatmaSoati}:00`);
  console.log(`     Tasdiq muddati:  ${cfg.tasdiqDaqiqa} daqiqa`);
} catch (xato) {
  console.error(`${XATO} ${xato.message}`);
  process.exit(1);
}

/* 2. ega ----------------------------------------------------------- */
if (cfg.egaId) {
  console.log(`${OK} OWNER_ID: ${cfg.egaId}`);
} else {
  console.log(`${OGOH} OWNER_ID bo‘sh — bot ishlaydi, lekin javob bermaydi va eslatmaydi.`);
  console.log('     Botni ishga tushirib, unga /id yozing va raqamni .env ga qo‘ying.');
  muammo += 1;
}

/* 3. baza ---------------------------------------------------------- */
try {
  const daftar = new Daftar(cfg.bazaYoli);
  const kutayotgan = daftar.kutilayotganlar().length;
  console.log(`${OK} Baza yoziladi: ${cfg.bazaYoli}`);
  console.log(`     ${daftar.yozuvlar.length} yozuv${kutayotgan ? `, ${kutayotgan} tasi tasdiq kutmoqda` : ''}`);
} catch (xato) {
  console.error(`${XATO} Bazaga yozib bo‘lmadi: ${xato.message}`);
  muammo += 1;
}

/* 4. Telegram ------------------------------------------------------ */
const telegram = new Telegram(cfg.token, cfg.telegramAsos);
let telegramIshladi = false;

try {
  const men = await telegram.chaqir('getMe');
  console.log(`${OK} Telegram: @${men.username} (${men.first_name})`);
  telegramIshladi = true;
} catch (xato) {
  console.error(`${XATO} Telegram: ${xato.message}`);
  muammo += 1;
}

/* 4b. 409 ning sababi: webhook yoki ikkinchi nusxa ------------------ */
if (telegramIshladi) {
  // webhook long polling bilan birga ishlamaydi
  try {
    const webhook = await telegram.webhookMalumoti();
    if (webhook.url) {
      console.error(`${XATO} Botga webhook o'rnatilgan: ${webhook.url}`);
      console.error('     Long polling u bilan ishlamaydi. Tuzatish:  npm run webhook-ochir');
      muammo += 1;
    } else {
      console.log(`${OK} Webhook yo'q (long polling uchun to'g'ri)`);
    }
  } catch (xato) {
    console.error(`${XATO} Webhook holatini bilib bo'lmadi: ${xato.message}`);
    muammo += 1;
  }

  // bu tokenni boshqa jarayon o'qiyaptimi? 409 shuni bildiradi
  try {
    await telegram.chaqir('getUpdates', { offset: -1, timeout: 0, limit: 1 }, { kutish: 15000 });
    console.log(`${OK} Tokenni boshqa hech kim o'qimayapti`);
  } catch (xato) {
    if (xato.kod === 409) {
      console.error(`${XATO} Bu bot tokeni allaqachon band - boshqa nusxa ishlayapti.`);
      console.error('     Windows:  Get-Process node | Select-Object Id, StartTime');
      console.error('               Stop-Process -Id <ID>');
      console.error('     Linux:    sudo systemctl stop daftar-bot');
      console.error('               pkill -f "node src/index.js"');
      muammo += 1;
    } else {
      console.error(`${XATO} getUpdates: ${xato.message}`);
      muammo += 1;
    }
  }
}

/* 5. til modeli ---------------------------------------------------- */
try {
  const miya = miyaYaratish(cfg);
  const messages = miya.tayyorlash({
    yoriqnoma: 'Faqat "ha" deb javob ber.',
    tarix: [],
    xabar: 'Tayyormisan?',
  });
  const javob = await miya.sorov({ messages, vositalar: [] });
  console.log(`${OK} ${cfg.xizmat} javob berdi: "${javob.matn.slice(0, 60)}"`);
} catch (xato) {
  console.error(`${XATO} ${cfg.xizmat}: ${xato.message}`);
  muammo += 1;
}

/* 6. ovoz ---------------------------------------------------------- */
if (cfg.asr === 'yoq') {
  console.log(`${OGOH} Ovozli xabar o‘chirilgan — OPENAI_API_KEY yoki DEEPGRAM_API_KEY yo‘q.`);
  console.log('     Yozma xabarlar to‘liq ishlaydi.');
} else {
  const manzil = cfg.asr === 'openai'
    ? 'https://api.openai.com/v1/models'
    : 'https://api.deepgram.com/v1/projects';
  const sarlavha = cfg.asr === 'openai'
    ? { authorization: `Bearer ${cfg.openaiKalit}` }
    : { authorization: `Token ${cfg.deepgramKalit}` };
  try {
    const javob = await fetch(manzil, { headers: sarlavha, signal: AbortSignal.timeout(20000) });
    if (javob.ok) console.log(`${OK} Ovoz xizmati (${cfg.asr}) kalitni qabul qildi`);
    else {
      console.error(`${XATO} Ovoz xizmati (${cfg.asr}): HTTP ${javob.status}`);
      muammo += 1;
    }
  } catch (xato) {
    console.error(`${XATO} Ovoz xizmati (${cfg.asr}): ${xato.message}`);
    muammo += 1;
  }
}

console.log(
  muammo === 0
    ? `\n${OK} Hammasi joyida. "npm start" bilan ishga tushiring.\n`
    : `\n${OGOH} ${muammo} ta muammo bor — yuqoridagi izohlarga qarang.\n`,
);
process.exit(muammo === 0 ? 0 : 1);
