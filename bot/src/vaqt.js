/**
 * Sana/vaqt yordamchilari. Hammasi belgilangan vaqt mintaqasida (Asia/Tashkent)
 * hisoblanadi, serverning o'z vaqti qanday bo'lishidan qat'i nazar.
 * Sanalar doim 'YYYY-MM-DD' matn ko'rinishida yuritiladi.
 */

const OYLAR = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const KUNLAR = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const ikki = (n) => String(n).padStart(2, '0');

/** Berilgan vaqt mintaqasidagi hozirgi yil/oy/kun/soat/daqiqa */
export function hozir(vaqtMintaqasi, sana = new Date()) {
  const bolaklar = new Intl.DateTimeFormat('en-GB', {
    timeZone: vaqtMintaqasi,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(sana);

  const p = {};
  for (const { type, value } of bolaklar) p[type] = value;

  const yil = Number(p.year);
  const oy = Number(p.month);
  const kun = Number(p.day);
  const iso = `${yil}-${ikki(oy)}-${ikki(kun)}`;

  return {
    yil,
    oy,
    kun,
    soat: Number(p.hour),
    daqiqa: Number(p.minute),
    sana: iso,
    oyKodi: `${yil}-${ikki(oy)}`,
    hafta: KUNLAR[new Date(`${iso}T00:00:00Z`).getUTCDay()],
  };
}

/** 'YYYY-MM-DD' ko'rinishidagi bugungi sana */
export const bugun = (vaqtMintaqasi) => hozir(vaqtMintaqasi).sana;

/** ISO sanani Date (UTC yarim tunda) ga aylantiradi — kunlarni sanash uchun */
function isoDate(iso) {
  if (!tugriIso(iso)) return null;
  const vaqt = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(vaqt) ? null : vaqt;
}

/** 'YYYY-MM-DD' shaklini va sananing haqiqiyligini tekshiradi */
export function tugriIso(qiymat) {
  if (typeof qiymat !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(qiymat)) return false;
  const [y, o, k] = qiymat.split('-').map(Number);
  if (o < 1 || o > 12 || k < 1 || k > 31) return false;
  const d = new Date(Date.UTC(y, o - 1, k));
  return d.getUTCFullYear() === y && d.getUTCMonth() === o - 1 && d.getUTCDate() === k;
}

/** b - a, kunlarda. Manfiy son = a kelajakda */
export function kunFarqi(a, b) {
  const x = isoDate(a);
  const y = isoDate(b);
  if (x === null || y === null) return null;
  return Math.round((y - x) / 86400000);
}

/** ISO sanaga kun qo'shadi */
export function kunQoshish(iso, kunlar) {
  const vaqt = isoDate(iso);
  if (vaqt === null) return null;
  const d = new Date(vaqt + kunlar * 86400000);
  return `${d.getUTCFullYear()}-${ikki(d.getUTCMonth() + 1)}-${ikki(d.getUTCDate())}`;
}

/** '2026-09-15' -> '15.09.2026' */
export function sanaKorinishi(iso) {
  if (!tugriIso(iso)) return '—';
  const [y, o, k] = iso.split('-');
  return `${k}.${o}.${y}`;
}

/** '2026-09' -> 'Sentabr 2026' */
export function oyNomi(oyKodi) {
  if (!/^\d{4}-\d{2}$/.test(String(oyKodi))) return String(oyKodi);
  const [y, o] = oyKodi.split('-').map(Number);
  return `${OYLAR[o - 1] ?? o} ${y}`;
}

/** '2026-09' -> { boshi: '2026-09-01', oxiri: '2026-09-30' } */
export function oyOraligi(oyKodi) {
  const [y, o] = String(oyKodi).split('-').map(Number);
  const oxirgiKun = new Date(Date.UTC(y, o, 0)).getUTCDate();
  return { boshi: `${y}-${ikki(o)}-01`, oxiri: `${y}-${ikki(o)}-${ikki(oxirgiKun)}` };
}

/** '2026-01' -> '2025-12' */
export function oldingiOy(oyKodi) {
  const [y, o] = String(oyKodi).split('-').map(Number);
  return o === 1 ? `${y - 1}-12` : `${y}-${ikki(o - 1)}`;
}

/** 12000000 -> '12 000 000' */
export function summaKorinishi(summa) {
  if (typeof summa !== 'number' || !Number.isFinite(summa)) return '—';
  return Math.round(summa).toLocaleString('ru-RU').replace(/ /g, ' ');
}
