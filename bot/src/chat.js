/**
 * Terminal rejimi — "npm run chat".
 *
 * Telegramsiz, botsiz: agent bilan to'g'ridan-to'g'ri terminalda gaplashasiz.
 * Bir xil daftar, bir xil vositalar, bir xil yozuvlar — faqat oyna boshqacha.
 * Telegram tokeni kerak emas, faqat model kaliti.
 *
 * Botni sozlashdan oldin sinab ko'rish uchun eng qulay yo'l.
 * PowerShell'da ham, Mac/Linux terminalida ham bir xil ishlaydi.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as kirish, stdout as chiqish } from 'node:process';

import { sozlamalar, ROOT } from './config.js';
import { Daftar } from './store.js';
import { Agent, agentXatosi } from './agent.js';
import { excelTuzish, oylikHisobotMatni, ochiqlarMatni, qisqaSatr } from './hisobot.js';
import { muddatiKelganlar } from './eslatma.js';
import { hozir, oldingiOy } from './vaqt.js';

/* ------------------------------------------------------------------ */
/* rang — terminal qo'llab-quvvatlamasa o'zi o'chadi                   */
/* ------------------------------------------------------------------ */

// vosita loglari suhbatni to'smasin (agent.js shu o'zgaruvchiga qaraydi)
process.env.DAFTAR_JIM = process.env.DAFTAR_JIM ?? '1';

const ESC = String.fromCharCode(27);
const RANGLI = chiqish.isTTY && process.env.NO_COLOR === undefined;
const bo = (kod) => (matn) => (RANGLI ? `${ESC}[${kod}m${matn}${ESC}[0m` : String(matn));

const rang = {
  kul: bo(90), yashil: bo(32), sariq: bo(33), qizil: bo(31), qalin: bo(1),
};

/** joriy qatorni tozalaydi ("o'ylayapman" yozuvini olib tashlash uchun) */
const qatorniTozala = () => {
  if (RANGLI) chiqish.write(`${String.fromCharCode(13)}${ESC}[K`);
  else chiqish.write('\n');
};

/** Hisobotlar HTML qaytaradi — terminalda teglar kerak emas */
const tegsiz = (matn) => String(matn)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const YORDAM = `
${rang.qalin('Shunchaki yozing:')}
  Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to'laydi
  Akmalga 5 mln qarz berdim, oyning oxirida qaytaradi
  Jasurga kardiograf vaqtincha berdim, 20 kundan keyin qaytaradi
  Nodirga monitor sotdim, 8 mln, pulini oldim
  Sardor qaytardi
  Yo'q, 5 mln emas 6 mln edi

${rang.qalin('Buyruqlar:')}
  /royxat     qaytarilmaganlar
  /excel      Excel fayl yaratish
  /oy         shu oy hisoboti
  /otganoy    o'tgan oy hisoboti
  /bekor      suhbat tarixini tozalash
  /yordam     shu ro'yxat
  /chiq       chiqish (Ctrl+C ham bo'ladi)
`;

/* ------------------------------------------------------------------ */

async function asosiy() {
  let cfg;
  try {
    cfg = sozlamalar({ telegramShart: false });   // terminalda Telegram kerak emas
  } catch (xato) {
    console.error(`\n${rang.qizil(xato.message)}\n`);
    process.exit(1);
  }

  const daftar = new Daftar(cfg.bazaYoli);
  const agent = new Agent(cfg, daftar);
  const CHAT_ID = 'terminal';
  const v = hozir(cfg.vaqtMintaqasi);

  console.log(`\n${rang.qalin('\u{1F4D2} Daftar — terminal rejimi')}   ${rang.kul(`${cfg.xizmat}/${cfg.model}`)}`);
  console.log(rang.kul(`   Baza:  ${cfg.bazaYoli}`));
  console.log(rang.kul(`   Bugun: ${v.sana} (${v.hafta}) — ${daftar.yozuvlar.length} yozuv`));

  const kelganlar = muddatiKelganlar(daftar.yozuvlar, v.sana);
  if (kelganlar.length) {
    console.log(`\n${rang.sariq(`⏰ Muddati kelgan yoki o‘tgan — ${kelganlar.length} ta`)}`);
    for (const y of kelganlar) console.log(`   • ${qisqaSatr(y)}`);
  }

  console.log(rang.kul('\n   /yordam — misollar va buyruqlar'));

  const rl = readline.createInterface({
    input: kirish,
    output: chiqish,
    terminal: Boolean(chiqish.isTTY),
  });
  rl.on('SIGINT', () => rl.close());

  // async iterator kirish tugaganini (Ctrl+D, quvur) aniq bildiradi
  const qatorlar = rl[Symbol.asyncIterator]();

  for (;;) {
    chiqish.write(`\n${rang.yashil('>')} `);
    const { value, done } = await qatorlar.next();
    if (done) break;                               // Ctrl+C, Ctrl+D yoki kirish tugadi
    const satr = String(value).trim();

    if (!satr) continue;
    if (['/chiq', '/exit', '/q', '/quit'].includes(satr.toLowerCase())) break;

    const buyruq = satr.match(/^\/([a-z]+)/i)?.[1]?.toLowerCase();
    if (buyruq && buyruqniBajar(buyruq, { daftar, cfg })) continue;

    chiqish.write(rang.kul('   …o‘ylayapman'));
    try {
      const natija = await agent.javob({ chatId: CHAT_ID, matn: satr });
      qatorniTozala();

      console.log(`${rang.kul('\u{1F916}')} ${natija.javob.split('\n').join('\n   ')}`);
      for (const tayyor of natija.tayyorMatnlar) console.log(`\n${tegsiz(tayyor)}`);
      for (const fayl of natija.fayllar) console.log(`\n${faylniSaqlash(fayl)}`);
    } catch (xato) {
      qatorniTozala();
      console.log(rang.qizil(`⚠ ${agentXatosi(xato)}`));
    }
  }

  rl.close();
  console.log(rang.kul('\n\u{1F44B} Xayr. Yozuvlaringiz saqlandi.\n'));
}

/** @returns {boolean} buyruq tanildimi */
function buyruqniBajar(buyruq, { daftar, cfg }) {
  const v = hozir(cfg.vaqtMintaqasi);

  switch (buyruq) {
    case 'yordam':
    case 'help':
    case 'start':
      console.log(YORDAM);
      return true;

    case 'royxat':
      console.log(`\n${tegsiz(ochiqlarMatni(daftar.yozuvlar, cfg.vaqtMintaqasi))}`);
      return true;

    case 'excel':
      if (!daftar.yozuvlar.length) {
        console.log(rang.sariq('\n   Daftar hali bo‘sh.'));
        return true;
      }
      console.log(`\n${faylniSaqlash(excelTuzish(daftar.yozuvlar, { vaqtMintaqasi: cfg.vaqtMintaqasi }))}`);
      return true;

    case 'oy':
      console.log(`\n${tegsiz(oylikHisobotMatni(daftar.yozuvlar, v.oyKodi, cfg.vaqtMintaqasi))}`);
      return true;

    case 'otganoy':
      console.log(`\n${tegsiz(oylikHisobotMatni(daftar.yozuvlar, oldingiOy(v.oyKodi), cfg.vaqtMintaqasi))}`);
      return true;

    case 'bekor':
      daftar.tarixniTozalash('terminal');
      console.log(rang.kul('\n   \u{1F9F9} Suhbat tarixi tozalandi. Yozuvlar joyida.'));
      return true;

    default:
      return false;                                // buyruq emas — agentga beramiz
  }
}

/** Excel faylni diskka yozadi va yo'lini qaytaradi */
function faylniSaqlash(fayl) {
  const papka = path.join(ROOT, 'hisobotlar');
  fs.mkdirSync(papka, { recursive: true });
  const yol = path.join(papka, fayl.nom);
  fs.writeFileSync(yol, fayl.buffer);
  return `   \u{1F4CA} ${fayl.qatorlar} qator saqlandi:\n   ${yol}`;
}

asosiy().catch((xato) => {
  console.error(rang.qizil(`\nKutilmagan xato: ${xato.message}`));
  process.exit(1);
});
