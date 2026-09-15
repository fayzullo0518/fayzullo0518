/**
 * Hisobotlar — Excel fayl va botning o'zidagi matnli oylik xulosa.
 */
import { buildWorkbook } from './xlsx.js';
import { TURLAR, HOLATLAR } from './store.js';
import {
  bugun, kunFarqi, oyOraligi, oyNomi, sanaKorinishi, summaKorinishi,
} from './vaqt.js';
import { esc } from './telegram.js';

const USTUNLAR = [
  { key: 'id', label: 'ID', width: 8 },
  { key: 'berilgan', label: 'Berilgan sana', width: 14 },
  { key: 'kim', label: 'Kim', width: 22 },
  { key: 'turi', label: 'Turi', width: 28 },
  { key: 'nima', label: 'Nima berildi', width: 32 },
  { key: 'summa', label: 'Summa', width: 15 },
  { key: 'valyuta', label: 'Valyuta', width: 9 },
  { key: 'qaytarish', label: 'Qaytarish sanasi', width: 16 },
  { key: 'holat', label: 'Holat', width: 18 },
  { key: 'qaytarilgan', label: 'Qaytarilgan sana', width: 16 },
  { key: 'qoldiq', label: 'Qoldiq summa', width: 15 },
  { key: 'kechikish', label: 'Kechikkan kun', width: 14 },
  { key: 'izoh', label: 'Izoh', width: 40 },
];

/** bitta yozuvni Excel qatoriga aylantiradi */
function qator(y, bugungi) {
  const ochiq = y.holat !== 'qaytarildi';
  const kechikish =
    ochiq && y.qaytarish_sanasi ? Math.max(0, kunFarqi(y.qaytarish_sanasi, bugungi) ?? 0) : 0;

  return {
    id: y.id,
    berilgan: sanaKorinishi(y.berilgan_sana),
    kim: y.kim || '',
    turi: TURLAR[y.turi] || y.turi,
    nima: y.nima || '',
    summa: typeof y.summa === 'number' ? y.summa : '',
    valyuta: y.summa ? y.valyuta || '' : '',
    qaytarish: y.qaytarish_sanasi ? sanaKorinishi(y.qaytarish_sanasi) : '',
    holat: HOLATLAR[y.holat] || y.holat,
    qaytarilgan: y.qaytarilgan_sana ? sanaKorinishi(y.qaytarilgan_sana) : '',
    qoldiq: ochiq && typeof y.summa === 'number'
      ? Math.max(0, y.summa - (y.qaytarilgan_summa || 0))
      : '',
    kechikish: kechikish || '',
    izoh: y.izoh || '',
  };
}

const saralash = (a, b) => String(a.berilgan_sana || '').localeCompare(String(b.berilgan_sana || ''));

/**
 * Uchta varaqli Excel: hammasi / qaytarilmaganlar / qaytarilganlar.
 * @returns {{buffer: Buffer, nom: string, qatorlar: number}}
 */
export function excelTuzish(yozuvlar, { vaqtMintaqasi, nomQoshimcha = '' } = {}) {
  const bugungi = bugun(vaqtMintaqasi);
  const hammasi = [...yozuvlar].sort(saralash);
  const ochiqlar = hammasi.filter((y) => y.holat !== 'qaytarildi');
  const yopiqlar = hammasi.filter((y) => y.holat === 'qaytarildi');

  const buffer = buildWorkbook([
    { name: 'Hammasi', columns: USTUNLAR, rows: hammasi.map((y) => qator(y, bugungi)) },
    { name: 'Qaytarilmagan', columns: USTUNLAR, rows: ochiqlar.map((y) => qator(y, bugungi)) },
    { name: 'Qaytarilgan', columns: USTUNLAR, rows: yopiqlar.map((y) => qator(y, bugungi)) },
  ]);

  const qism = nomQoshimcha ? `-${nomQoshimcha}` : '';
  return { buffer, nom: `daftar${qism}-${bugungi}.xlsx`, qatorlar: hammasi.length };
}

/** Valyutalar bo'yicha yig'indi: { UZS: 12000000, USD: 500 } */
function summalar(yozuvlar, tanlov = (y) => y.summa) {
  const jami = {};
  for (const y of yozuvlar) {
    const qiymat = tanlov(y);
    if (typeof qiymat !== 'number' || !Number.isFinite(qiymat) || qiymat === 0) continue;
    const v = y.valyuta || 'UZS';
    jami[v] = (jami[v] || 0) + qiymat;
  }
  return jami;
}

const summaMatni = (jami) => {
  const qismlar = Object.entries(jami).map(([v, s]) => `${summaKorinishi(s)} ${v}`);
  return qismlar.length ? qismlar.join(' + ') : '0';
};

/** Oylik xulosa — HTML matn (Telegram uchun) */
export function oylikHisobotMatni(yozuvlar, oyKodi, vaqtMintaqasi) {
  const { boshi, oxiri } = oyOraligi(oyKodi);
  const bugungi = bugun(vaqtMintaqasi);

  const oyIchida = (sana) => sana && sana >= boshi && sana <= oxiri;

  // sotuv — yopiq savdo, uni "berildi / qaytarildi" bilan aralashtirmaymiz
  const berilgan = yozuvlar.filter((y) => y.turi !== 'sotuv' && oyIchida(y.berilgan_sana));
  const sotilgan = yozuvlar.filter((y) => y.turi === 'sotuv' && oyIchida(y.berilgan_sana));
  const qaytarilgan = yozuvlar.filter((y) => y.turi !== 'sotuv' && oyIchida(y.qaytarilgan_sana));
  // oy oxiriga qadar berilgan va hali ham yopilmagan hamma yozuv
  const qaytarilmagan = yozuvlar.filter(
    (y) => y.holat !== 'qaytarildi' && (y.berilgan_sana || '') <= oxiri,
  );

  const qatorlar = [`📅 <b>${esc(oyNomi(oyKodi))} — oylik hisobot</b>`, ''];

  const bolim = (belgi, sarlavha, royxat, jami, chegara = 15) => {
    qatorlar.push(`${belgi} <b>${sarlavha}:</b> ${royxat.length} ta — ${esc(summaMatni(jami))}`);
    for (const y of royxat.slice(0, chegara)) qatorlar.push(`   ${esc(qisqaSatr(y))}`);
    if (royxat.length > chegara) qatorlar.push(`   … va yana ${royxat.length - chegara} ta`);
    qatorlar.push('');
  };

  bolim('📤', 'Berildi', berilgan, summalar(berilgan));
  if (sotilgan.length) bolim('💰', 'Sotildi', sotilgan, summalar(sotilgan));
  bolim('✅', 'Qaytarildi', qaytarilgan, summalar(qaytarilgan, (y) => y.qaytarilgan_summa || y.summa));
  const qoldiq = summalar(qaytarilmagan, (y) => (y.summa || 0) - (y.qaytarilgan_summa || 0));
  qatorlar.push(`❌ <b>Qaytarilmadi:</b> ${qaytarilmagan.length} ta — ${esc(summaMatni(qoldiq))}`);
  for (const y of qaytarilmagan.slice(0, 20)) {
    const kech = y.qaytarish_sanasi ? kunFarqi(y.qaytarish_sanasi, bugungi) : null;
    const belgi = kech !== null && kech > 0 ? ` ⏰ ${kech} kun kechikdi` : '';
    qatorlar.push(`   ${esc(qisqaSatr(y))}${belgi}`);
  }
  if (qaytarilmagan.length > 20) qatorlar.push(`   … va yana ${qaytarilmagan.length - 20} ta`);

  return qatorlar.join('\n');
}

/** "Y0007 • Sardor • UZI apparati • 12 000 000 UZS • 01.10.2026 gacha" */
export function qisqaSatr(y) {
  // hali tasdiqlanmagan (ovozdan yozilgan) yozuv ajralib tursin
  const qismlar = [y.tasdiq === 'kutilmoqda' ? `${y.id} ⏳` : y.id, y.kim || '?'];
  if (y.nima) qismlar.push(y.nima);
  if (typeof y.summa === 'number') qismlar.push(`${summaKorinishi(y.summa)} ${y.valyuta || 'UZS'}`);
  if (y.qaytarish_sanasi) qismlar.push(`${sanaKorinishi(y.qaytarish_sanasi)} gacha`);
  return qismlar.join(' • ');
}

/** Ochiq yozuvlar ro'yxati — HTML */
export function ochiqlarMatni(yozuvlar, vaqtMintaqasi) {
  const bugungi = bugun(vaqtMintaqasi);
  const ochiq = yozuvlar
    .filter((y) => y.holat !== 'qaytarildi')
    .sort((a, b) => String(a.qaytarish_sanasi || '9999').localeCompare(String(b.qaytarish_sanasi || '9999')));

  if (!ochiq.length) return '✅ Qaytarilmagan narsa yo‘q — daftar toza.';

  const kechikkan = ochiq.filter((y) => y.qaytarish_sanasi && y.qaytarish_sanasi < bugungi);
  const bugungiLar = ochiq.filter((y) => y.qaytarish_sanasi === bugungi);
  const keyingi = ochiq.filter((y) => !y.qaytarish_sanasi || y.qaytarish_sanasi > bugungi);

  const qatorlar = [`\u{1F4CB} <b>Qaytarilmaganlar — ${ochiq.length} ta</b>`];

  if (kechikkan.length) {
    qatorlar.push('', `⏰ <b>Kechikkan (${kechikkan.length})</b>`);
    for (const y of kechikkan) {
      qatorlar.push(`   ${esc(qisqaSatr(y))} — ${kunFarqi(y.qaytarish_sanasi, bugungi)} kun`);
    }
  }
  if (bugungiLar.length) {
    qatorlar.push('', `\u{1F514} <b>Bugun (${bugungiLar.length})</b>`);
    for (const y of bugungiLar) qatorlar.push(`   ${esc(qisqaSatr(y))}`);
  }
  if (keyingi.length) {
    qatorlar.push('', `\u{1F4C6} <b>Keyinroq (${keyingi.length})</b>`);
    for (const y of keyingi) qatorlar.push(`   ${esc(qisqaSatr(y))}`);
  }

  return qatorlar.join('\n');
}
