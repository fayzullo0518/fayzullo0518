/**
 * Til modeli sinovi — "npm run llm-sinov".
 *
 * .env dagi model (DeepSeek yoki Claude) bilan HAQIQIY so'rov yuboradi va
 * o'zbekcha gaplarni qanchalik to'g'ri tushunishini o'lchaydi: ismni,
 * summani, sanani, yozuv turini. Telegram kerak emas — faqat model kaliti.
 *
 * Bir marta ishlatish ~6 ta so'rov (DeepSeek'da bir tiyindan ham arzon).
 * Ikkala modelni solishtirish uchun .env dagi LLM_XIZMATI ni almashtiring.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sozlamalar } from '../src/config.js';
import { Daftar } from '../src/store.js';
import { Agent } from '../src/agent.js';
import { bugun, kunQoshish, sanaKorinishi, summaKorinishi } from '../src/vaqt.js';

const OK = '✅';
const XATO = '❌';

let cfg;
try {
  cfg = sozlamalar();
} catch (xato) {
  console.error(`\n${XATO} ${xato.message}\n`);
  process.exit(1);
}

const BUGUN = bugun(cfg.vaqtMintaqasi);
const ikki = (n) => String(n).padStart(2, '0');

/** Shu yildagi eng yaqin kelgusi sana: (10, 1) -> '2026-10-01' */
function yaqinSana(oy, kun) {
  const yil = Number(BUGUN.slice(0, 4));
  const nomzod = `${yil}-${ikki(oy)}-${ikki(kun)}`;
  return nomzod >= BUGUN ? nomzod : `${yil + 1}-${ikki(oy)}-${ikki(kun)}`;
}

/* ================================================================== */
/* sinovlar                                                            */
/* ================================================================== */

const SINOVLAR = [
  {
    matn: 'Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to‘laydi',
    izoh: 'apparat + qarz, "12 mln", "1-oktabrgacha"',
    kutilgan: {
      kim: /sardor/i,
      turi: 'apparat_qarz',
      nima: /uzi/i,
      summa: 12000000,
      qaytarish_sanasi: yaqinSana(10, 1),
    },
  },
  {
    matn: 'Akmalga besh million qarz berdim, o‘ttiz sentabrda qaytaradi',
    izoh: 'summa so‘z bilan: "besh million", sana "o‘ttiz sentabrda"',
    kutilgan: {
      kim: /akmal/i,
      turi: 'pul_qarz',
      summa: 5000000,
      qaytarish_sanasi: yaqinSana(9, 30),
    },
  },
  {
    matn: 'Jasurga kardiograf vaqtincha berdim, 20 kundan keyin qaytaradi',
    izoh: 'ijara, nisbiy sana: "20 kundan keyin"',
    kutilgan: {
      kim: /jasur/i,
      turi: 'apparat_ijara',
      nima: /kardiograf/i,
      qaytarish_sanasi: kunQoshish(BUGUN, 20),
    },
  },
  {
    matn: 'Nodirga monitor sotdim, 8 mln, pulini to‘liq oldim',
    izoh: 'sotuv — darrov yopiq bo‘lishi kerak',
    kutilgan: {
      kim: /nodir/i,
      turi: 'sotuv',
      summa: 8000000,
      holat: 'qaytarildi',
    },
  },
  {
    matn: 'Dilshodga uch yuz dollar berdim',
    izoh: 'valyuta: USD, sana aytilmagan',
    kutilgan: {
      kim: /dilshod/i,
      summa: 300,
      valyuta: 'USD',
      qaytarish_sanasi: null,
    },
  },
  {
    matn: 'Sardor qaytardi',
    izoh: 'oldingi yozuvni topib yopish',
    tekshirNishoni: /sardor/i,
    kutilgan: { holat: 'qaytarildi' },
  },
];

/* ================================================================== */
/* solishtirish                                                        */
/* ================================================================== */

function taqqosla(yozuv, kutilgan) {
  const xatolar = [];
  for (const [maydon, kutilganQiymat] of Object.entries(kutilgan)) {
    const bor = yozuv[maydon];
    const tugri = kutilganQiymat instanceof RegExp
      ? kutilganQiymat.test(String(bor ?? ''))
      : bor === kutilganQiymat;
    if (!tugri) {
      xatolar.push(`${maydon}: kutilgan ${korinish(maydon, kutilganQiymat)}, keldi ${korinish(maydon, bor)}`);
    }
  }
  return xatolar;
}

function korinish(maydon, qiymat) {
  if (qiymat instanceof RegExp) return String(qiymat).replace(/[/i]/g, '');
  if (qiymat === null || qiymat === undefined) return '(yo‘q)';
  if (maydon === 'summa') return summaKorinishi(qiymat);
  if (maydon.endsWith('_sanasi')) return sanaKorinishi(qiymat);
  return String(qiymat);
}

/* ================================================================== */

const papka = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-sinov-'));
const daftar = new Daftar(path.join(papka, 'daftar.json'));
const agent = new Agent(cfg, daftar);

console.log(`\n\u{1F9EA} Til modeli sinovi — ${cfg.xizmat} / ${cfg.model}`);
console.log(`   Bugun: ${BUGUN} (${cfg.vaqtMintaqasi})\n`);

let otdi = 0;
const boshlandi = Date.now();

for (const [indeks, sinov] of SINOVLAR.entries()) {
  const raqam = `${indeks + 1}/${SINOVLAR.length}`;
  console.log(`  ${raqam}  \u{1F464} "${sinov.matn}"`);
  console.log(`       ${sinov.izoh}`);

  let javob;
  try {
    javob = await agent.javob({ chatId: 1, matn: sinov.matn });
  } catch (xato) {
    console.log(`       ${XATO} ${xato.message}\n`);
    break;
  }

  const yozuv = sinov.tekshirNishoni
    ? daftar.yozuvlar.find((y) => sinov.tekshirNishoni.test(y.kim))
    : javob.yangiYozuvlar.at(-1) || daftar.yozuvlar.at(-1);

  if (!yozuv) {
    console.log(`       ${XATO} yozuv umuman yaratilmadi`);
    console.log(`       bot javobi: "${javob.javob.slice(0, 100)}"\n`);
    continue;
  }

  const xatolar = taqqosla(yozuv, sinov.kutilgan);
  if (xatolar.length === 0) {
    otdi += 1;
    console.log(`       ${OK} ${yozuv.kim} — ${yozuv.turi}`
      + (yozuv.summa ? ` — ${summaKorinishi(yozuv.summa)} ${yozuv.valyuta}` : '')
      + (yozuv.qaytarish_sanasi ? ` — ${sanaKorinishi(yozuv.qaytarish_sanasi)}` : ''));
  } else {
    console.log(`       ${XATO} ${xatolar.join('\n          ')}`);
  }
  console.log('');
}

const soniya = ((Date.now() - boshlandi) / 1000).toFixed(1);
const foiz = Math.round((otdi / SINOVLAR.length) * 100);

console.log(`──────────────────────────────────────`);
console.log(`  ${otdi}/${SINOVLAR.length} to‘g‘ri (${foiz}%) — ${soniya}s — ${cfg.xizmat}/${cfg.model}`);
if (otdi === SINOVLAR.length) {
  console.log(`  ${OK} Model o‘zbek tilini yaxshi tushunmoqda.`);
} else if (foiz >= 70) {
  console.log(`  ⚠️  Ko‘pini tushunadi. Xato joylarni tasdiq tugmasi bilan tuzatasiz.`);
} else {
  console.log(`  ⚠️  Xato ko‘p. .env da LLM_XIZMATI=claude qilib solishtirib ko‘ring.`);
}
console.log('');

fs.rmSync(papka, { recursive: true, force: true });
process.exit(otdi === SINOVLAR.length ? 0 : 1);
