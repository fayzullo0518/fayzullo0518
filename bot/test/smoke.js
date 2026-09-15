/**
 * Tarmoqsiz sinov — Telegram va Anthropic'ga ulanmasdan hamma mantiqni tekshiradi.
 * Ishga tushirish:  npm test
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

import { Daftar, TURLAR } from '../src/store.js';
import { VOSITALAR, vositaniBajarish } from '../src/vositalar.js';
import { excelTuzish, oylikHisobotMatni, ochiqlarMatni, qisqaSatr } from '../src/hisobot.js';
import { muddatiKelganlar, eslatmaMatni, tugmalar } from '../src/eslatma.js';
import { esc } from '../src/telegram.js';
import { faylniTayyorlash } from '../src/asr.js';
import { Agent } from '../src/agent.js';
import { miyaYaratish, MiyaXatosi } from '../src/miya.js';
import { tasdiqlarniYopish } from '../src/eslatma.js';
import { tugmaniIshlash } from '../src/index.js';
import {
  hozir, bugun, tugriIso, kunFarqi, kunQoshish, oyOraligi, oldingiOy,
  sanaKorinishi, oyNomi, summaKorinishi,
} from '../src/vaqt.js';

let otdi = 0;
const sinovlar = [];
const sinov = (nom, fn) => sinovlar.push([nom, fn]);

const VAQT = 'Asia/Tashkent';
const papka = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-sinov-'));
const yol = path.join(papka, 'daftar.json');

const CFG = { vaqtMintaqasi: VAQT, valyuta: 'UZS' };
const ktx = (daftar) => ({ daftar, cfg: CFG, fayllar: [], tayyorMatnlar: [] });

/* ================================================================== */
/* vaqt                                                                */
/* ================================================================== */

sinov('vaqt: hozir() to‘g‘ri shaklda qaytaradi', () => {
  const v = hozir(VAQT);
  assert.match(v.sana, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(v.oyKodi, /^\d{4}-\d{2}$/);
  assert.ok(v.soat >= 0 && v.soat <= 23, `soat: ${v.soat}`);
  assert.ok(v.kun >= 1 && v.kun <= 31);
  assert.equal(v.sana.slice(0, 7), v.oyKodi);
  assert.equal(bugun(VAQT), v.sana);
});

sinov('vaqt: soat hech qachon 24 bo‘lmaydi (hourCycle h23)', () => {
  // yarim tundagi bir necha nuqtani tekshiramiz
  for (const iso of ['2026-01-01T19:00:00Z', '2026-06-15T19:30:00Z', '2026-12-31T19:00:00Z']) {
    const v = hozir(VAQT, new Date(iso));
    assert.ok(v.soat >= 0 && v.soat <= 23, `${iso} -> soat ${v.soat}`);
  }
  // Toshkent UTC+5: 19:00 UTC = ertasi kun 00:00
  const yarimTun = hozir(VAQT, new Date('2026-06-14T19:00:00Z'));
  assert.equal(yarimTun.soat, 0);
  assert.equal(yarimTun.sana, '2026-06-15');
});

sinov('vaqt: tugriIso mavjud bo‘lmagan sanani rad etadi', () => {
  assert.equal(tugriIso('2026-09-15'), true);
  assert.equal(tugriIso('2026-02-30'), false);
  assert.equal(tugriIso('2026-13-01'), false);
  assert.equal(tugriIso('15.09.2026'), false);
  assert.equal(tugriIso(''), false);
  assert.equal(tugriIso(null), false);
  assert.equal(tugriIso('2024-02-29'), true); // kabisa yili
});

sinov('vaqt: kunFarqi va kunQoshish', () => {
  assert.equal(kunFarqi('2026-09-01', '2026-09-15'), 14);
  assert.equal(kunFarqi('2026-09-15', '2026-09-01'), -14);
  assert.equal(kunFarqi('2026-12-31', '2027-01-01'), 1);
  assert.equal(kunQoshish('2026-09-25', 10), '2026-10-05');
  assert.equal(kunQoshish('2026-12-25', 10), '2027-01-04');
  assert.equal(kunQoshish('2024-02-28', 1), '2024-02-29');
});

sinov('vaqt: oy oraliqlari va nomlari', () => {
  assert.deepEqual(oyOraligi('2026-02'), { boshi: '2026-02-01', oxiri: '2026-02-28' });
  assert.deepEqual(oyOraligi('2024-02'), { boshi: '2024-02-01', oxiri: '2024-02-29' });
  assert.deepEqual(oyOraligi('2026-09'), { boshi: '2026-09-01', oxiri: '2026-09-30' });
  assert.equal(oldingiOy('2026-01'), '2025-12');
  assert.equal(oldingiOy('2026-09'), '2026-08');
  assert.equal(oyNomi('2026-09'), 'Sentabr 2026');
  assert.equal(sanaKorinishi('2026-09-05'), '05.09.2026');
  assert.equal(sanaKorinishi('buzuq'), '—');
  assert.equal(summaKorinishi(12000000), '12 000 000');
  assert.equal(summaKorinishi(null), '—');
});

/* ================================================================== */
/* vositalar sxemasi                                                   */
/* ================================================================== */

sinov('sxema: hamma vositalar strict qoidalariga mos', () => {
  assert.ok(VOSITALAR.length >= 7);
  for (const vosita of VOSITALAR) {
    assert.ok(vosita.name, 'nom bor');
    assert.ok(vosita.description.length > 20, `${vosita.name}: tavsif qisqa`);
    assert.equal(vosita.strict, true, `${vosita.name}: strict emas`);
    const s = vosita.input_schema;
    assert.equal(s.type, 'object');
    assert.equal(s.additionalProperties, false, `${vosita.name}: additionalProperties ochiq`);
    const maydonlar = Object.keys(s.properties);
    assert.deepEqual(
      [...s.required].sort(), maydonlar.sort(),
      `${vosita.name}: required hamma maydonni qamramaydi`,
    );
    // JSON.stringify qila olishi kerak — API ga shunday jo'natiladi
    assert.ok(JSON.stringify(vosita).length > 0);
  }
});

sinov('sxema: turi enum store.TURLAR bilan bir xil', () => {
  const qoshish = VOSITALAR.find((v) => v.name === 'yozuv_qoshish');
  assert.deepEqual(qoshish.input_schema.properties.turi.enum, Object.keys(TURLAR));
});

/* ================================================================== */
/* daftar (store)                                                      */
/* ================================================================== */

sinov('daftar: qo‘shish, topish, ketma-ket ID', () => {
  const d = new Daftar(yol);
  const a = d.qoshish({ kim: 'Sardor', turi: 'pul_qarz', summa: 5000000, berilgan_sana: '2026-09-01' });
  const b = d.qoshish({ kim: 'Jasur', turi: 'apparat_ijara', nima: 'Kardiograf', berilgan_sana: '2026-09-02' });
  assert.equal(a.id, 'Y0001');
  assert.equal(b.id, 'Y0002');
  assert.equal(a.holat, 'ochiq');
  assert.equal(a.valyuta, 'UZS');
  assert.equal(d.topish('y0001').kim, 'Sardor', 'ID katta-kichik harfga bog‘liq emas');
  assert.equal(d.topish('Y9999'), null);
});

sinov('daftar: sotuv darrov yopiq holatda saqlanadi', () => {
  const d = new Daftar(yol);
  const s = d.qoshish({ kim: 'Nodir', turi: 'sotuv', summa: 30000000, berilgan_sana: '2026-09-03' });
  assert.equal(s.holat, 'qaytarildi');
  assert.equal(s.qaytarilgan_sana, '2026-09-03');
  assert.equal(s.qaytarilgan_summa, 30000000);
});

sinov('daftar: diskka yozilib, qayta o‘qilganda saqlanadi', () => {
  const qayta = new Daftar(yol);
  assert.equal(qayta.yozuvlar.length, 3);
  assert.equal(qayta.topish('Y0001').kim, 'Sardor');
  // keyingi ID oldingisidan davom etadi
  const yangi = qayta.qoshish({ kim: 'Test', turi: 'pul_qarz', berilgan_sana: '2026-09-04' });
  assert.equal(yangi.id, 'Y0004');
  qayta.ochirish('Y0004');
  assert.equal(qayta.yozuvlar.length, 3);
});

sinov('daftar: buzilgan JSON botni yiqitmaydi', () => {
  const buzuqYol = path.join(papka, 'buzuq.json');
  fs.writeFileSync(buzuqYol, '{ bu json emas');
  const d = new Daftar(buzuqYol);
  assert.equal(d.yozuvlar.length, 0);
  assert.ok(fs.existsSync(buzuqYol), 'yangi bo‘sh baza yaratilgan');
  assert.ok(
    fs.readdirSync(papka).some((f) => f.includes('buzuq.json.buzilgan-')),
    'eski buzilgan fayl chetga surilgan',
  );
});

sinov('daftar: qidirish filtrlari', () => {
  const d = new Daftar(yol);
  assert.equal(d.qidirish({ kim: 'sardor' }).length, 1, 'ism kichik harfda ham topiladi');
  assert.equal(d.qidirish({ kim: 'SAR' }).length, 1, 'ismning qismi bo‘yicha');
  assert.equal(d.qidirish({ holat: 'ochiq' }).length, 2, 'sotuv ochiqlar ichida emas');
  assert.equal(d.qidirish({ turi: 'apparat_ijara' }).length, 1);
  assert.equal(d.qidirish({ matn: 'kardiograf' }).length, 1, 'apparat nomi bo‘yicha');
  assert.equal(d.qidirish({ sana_dan: '2026-09-02' }).length, 2);
  assert.equal(d.qidirish({}).length, 3);
});

sinov('daftar: suhbat tarixi kesiladi va user bilan boshlanadi', () => {
  const d = new Daftar(path.join(papka, 'tarix.json'));
  for (let i = 0; i < 40; i += 1) {
    d.tarixgaQoshish(7, 'user', `savol ${i}`, 3);
    d.tarixgaQoshish(7, 'assistant', `javob ${i}`, 3);
  }
  const tarix = d.tarix(7);
  assert.ok(tarix.length <= 6, `tarix uzunligi: ${tarix.length}`);
  assert.equal(tarix[0].role, 'user', 'birinchi xabar doim user bo‘lishi shart');
  d.tarixniTozalash(7);
  assert.equal(d.tarix(7).length, 0);
});

/* ================================================================== */
/* vositalar ishlovchilari                                             */
/* ================================================================== */

sinov('vosita: yozuv_qoshish to‘liq ma’lumot bilan', () => {
  const d = new Daftar(path.join(papka, 'v1.json'));
  const j = vositaniBajarish('yozuv_qoshish', {
    turi: 'apparat_qarz', kim: 'Sardor Aliyev', nima: 'UZI apparati Mindray DC-30',
    summa: 12000000, valyuta: 'UZS', berilgan_sana: '2026-09-15',
    qaytarish_sanasi: '2026-10-01', izoh: 'Klinikaga',
  }, ktx(d));

  assert.equal(j.ok, true);
  assert.equal(j.yozuv.kim, 'Sardor Aliyev');
  assert.equal(j.yozuv.summa, 12000000);
  assert.equal(j.yozuv.qaytarish_sanasi, '2026-10-01');
  assert.equal(d.yozuvlar.length, 1);
});

sinov('vosita: yozuv_qoshish sanani tekshiradi', () => {
  const d = new Daftar(path.join(papka, 'v2.json'));
  const yomonSana = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'X', nima: null, summa: 100, valyuta: 'UZS',
    berilgan_sana: '15.09.2026', qaytarish_sanasi: null, izoh: null,
  }, ktx(d));
  assert.equal(yomonSana.ok, false);
  assert.match(yomonSana.xato, /YYYY-MM-DD/);

  const teskari = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'X', nima: null, summa: 100, valyuta: 'UZS',
    berilgan_sana: '2026-09-15', qaytarish_sanasi: '2026-09-01', izoh: null,
  }, ktx(d));
  assert.equal(teskari.ok, false, 'qaytarish sanasi berilgan sanadan oldin bo‘lmasligi kerak');

  const ismsiz = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: '   ', nima: null, summa: 100, valyuta: 'UZS',
    berilgan_sana: '2026-09-15', qaytarish_sanasi: null, izoh: null,
  }, ktx(d));
  assert.equal(ismsiz.ok, false);
  assert.equal(d.yozuvlar.length, 0, 'xato yozuvlar saqlanmagan');
});

sinov('vosita: summa matn bo‘lib kelsa ham songa aylanadi', () => {
  const d = new Daftar(path.join(papka, 'v3.json'));
  const j = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'Akmal', nima: null, summa: '5000000', valyuta: 'UZS',
    berilgan_sana: '2026-09-10', qaytarish_sanasi: null, izoh: null,
  }, ktx(d));
  assert.equal(j.ok, true);
  assert.equal(j.yozuv.summa, 5000000);
  assert.equal(typeof j.yozuv.summa, 'number');
});

sinov('vosita: qaytarildi_belgilash — to‘liq', () => {
  const d = new Daftar(path.join(papka, 'v4.json'));
  const q = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'Akmal', nima: null, summa: 5000000, valyuta: 'UZS',
    berilgan_sana: '2026-09-01', qaytarish_sanasi: '2026-09-30', izoh: null,
  }, ktx(d));

  const j = vositaniBajarish('qaytarildi_belgilash',
    { id: q.yozuv.id, sana: '2026-09-28', summa: null, izoh: null }, ktx(d));

  assert.equal(j.ok, true);
  assert.equal(j.yozuv.holat, 'qaytarildi');
  assert.equal(j.yozuv.qaytarilgan_sana, '2026-09-28');
  assert.equal(j.yozuv.qaytarilgan_summa, 5000000);

  const takror = vositaniBajarish('qaytarildi_belgilash',
    { id: q.yozuv.id, sana: null, summa: null, izoh: null }, ktx(d));
  assert.equal(takror.allaqachon, true, 'ikki marta belgilash zarar qilmaydi');
});

sinov('vosita: qaytarildi_belgilash — qisman to‘lov', () => {
  const d = new Daftar(path.join(papka, 'v5.json'));
  const q = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'Bek', nima: null, summa: 10000000, valyuta: 'UZS',
    berilgan_sana: '2026-09-01', qaytarish_sanasi: '2026-10-01', izoh: null,
  }, ktx(d));

  const birinchi = vositaniBajarish('qaytarildi_belgilash',
    { id: q.yozuv.id, sana: '2026-09-20', summa: 4000000, izoh: null }, ktx(d));
  assert.equal(birinchi.yozuv.holat, 'qisman');
  assert.equal(birinchi.yozuv.qaytarilgan_summa, 4000000);

  const ikkinchi = vositaniBajarish('qaytarildi_belgilash',
    { id: q.yozuv.id, sana: '2026-09-25', summa: 6000000, izoh: null }, ktx(d));
  assert.equal(ikkinchi.yozuv.holat, 'qaytarildi', 'qoldiq to‘langach yopiladi');
  assert.equal(ikkinchi.yozuv.qaytarilgan_summa, 10000000);
});

sinov('vosita: mavjud bo‘lmagan ID xatolik qaytaradi, yiqilmaydi', () => {
  const d = new Daftar(path.join(papka, 'v6.json'));
  for (const nom of ['qaytarildi_belgilash', 'yozuvni_ochirish']) {
    const j = vositaniBajarish(nom, { id: 'Y9999', sana: null, summa: null, izoh: null }, ktx(d));
    assert.equal(j.ok, false, nom);
    assert.match(j.xato, /topilmadi/);
  }
  const notanish = vositaniBajarish('mavjud_emas', {}, ktx(d));
  assert.equal(notanish.ok, false);
});

sinov('vosita: yozuvni_yangilash faqat berilgan maydonni o‘zgartiradi', () => {
  const d = new Daftar(path.join(papka, 'v7.json'));
  const q = vositaniBajarish('yozuv_qoshish', {
    turi: 'pul_qarz', kim: 'Sardor', nima: null, summa: 5000000, valyuta: 'UZS',
    berilgan_sana: '2026-09-01', qaytarish_sanasi: '2026-09-30', izoh: 'birinchi',
  }, ktx(d));

  const j = vositaniBajarish('yozuvni_yangilash', {
    id: q.yozuv.id, kim: null, nima: null, summa: 6000000,
    valyuta: null, berilgan_sana: null, qaytarish_sanasi: null, izoh: null,
  }, ktx(d));

  assert.equal(j.ok, true);
  assert.equal(j.yozuv.summa, 6000000, 'summa yangilandi');
  assert.equal(j.yozuv.kim, 'Sardor', 'ism tegilmadi');
  assert.equal(j.yozuv.qaytarish_sanasi, '2026-09-30', 'sana tegilmadi');
  assert.equal(d.topish(q.yozuv.id).izoh, 'birinchi', 'izoh tegilmadi');

  const bosh = vositaniBajarish('yozuvni_yangilash', {
    id: q.yozuv.id, kim: null, nima: null, summa: null,
    valyuta: null, berilgan_sana: null, qaytarish_sanasi: null, izoh: null,
  }, ktx(d));
  assert.equal(bosh.ok, false, 'bo‘sh yangilash rad etiladi');
});

sinov('vosita: qidirish holat/tur bo‘yicha, "hammasi" filtrsiz', () => {
  const d = new Daftar(path.join(papka, 'v8.json'));
  const asos = { valyuta: 'UZS', izoh: null, nima: null };
  vositaniBajarish('yozuv_qoshish', { ...asos, turi: 'pul_qarz', kim: 'A', summa: 1000, berilgan_sana: '2026-09-01', qaytarish_sanasi: '2026-09-10' }, ktx(d));
  vositaniBajarish('yozuv_qoshish', { ...asos, turi: 'apparat_ijara', kim: 'B', nima: 'UZI', summa: null, berilgan_sana: '2026-09-02', qaytarish_sanasi: '2026-09-20' }, ktx(d));
  vositaniBajarish('yozuv_qoshish', { ...asos, turi: 'sotuv', kim: 'C', summa: 9000, berilgan_sana: '2026-09-03', qaytarish_sanasi: null }, ktx(d));

  const hammasi = vositaniBajarish('yozuvlarni_qidirish',
    { kim: null, matn: null, turi: 'hammasi', holat: 'hammasi', sana_dan: null, sana_gacha: null }, ktx(d));
  assert.equal(hammasi.soni, 3);

  const ochiq = vositaniBajarish('yozuvlarni_qidirish',
    { kim: null, matn: null, turi: 'hammasi', holat: 'ochiq', sana_dan: null, sana_gacha: null }, ktx(d));
  assert.equal(ochiq.soni, 2, 'sotuv ochiqlar ichida emas');

  const ijara = vositaniBajarish('yozuvlarni_qidirish',
    { kim: null, matn: null, turi: 'apparat_ijara', holat: 'hammasi', sana_dan: null, sana_gacha: null }, ktx(d));
  assert.equal(ijara.soni, 1);
  assert.equal(ijara.yozuvlar[0].kim, 'B');
});

/* ================================================================== */
/* hisobotlar                                                          */
/* ================================================================== */

function namunaviyDaftar(nom) {
  const d = new Daftar(path.join(papka, nom));
  const asos = { valyuta: 'UZS', izoh: null };
  d.qoshish({ ...asos, turi: 'apparat_qarz', kim: 'Sardor', nima: 'UZI apparati', summa: 12000000, berilgan_sana: '2026-09-02', qaytarish_sanasi: '2026-09-25' });
  d.qoshish({ ...asos, turi: 'apparat_ijara', kim: 'Jasur', nima: 'Kardiograf', summa: null, berilgan_sana: '2026-09-05', qaytarish_sanasi: '2026-09-12' });
  d.qoshish({ ...asos, turi: 'pul_qarz', kim: 'Akmal', nima: null, summa: 5000000, berilgan_sana: '2026-09-08', qaytarish_sanasi: '2026-09-30' });
  d.qoshish({ ...asos, turi: 'pul_qarz', kim: 'Dilshod', nima: null, summa: 300, valyuta: 'USD', berilgan_sana: '2026-09-09', qaytarish_sanasi: '2026-10-09' });
  d.qoshish({ ...asos, turi: 'sotuv', kim: 'Nodir', nima: 'Monitor', summa: 8000000, berilgan_sana: '2026-09-10', qaytarish_sanasi: null });
  // Jasur qaytardi
  vositaniBajarish('qaytarildi_belgilash', { id: 'Y0002', sana: '2026-09-12', summa: null, izoh: null }, ktx(d));
  return d;
}

sinov('hisobot: Excel haqiqiy xlsx (zip) fayl', () => {
  const d = namunaviyDaftar('h1.json');
  const fayl = excelTuzish(d.yozuvlar, { vaqtMintaqasi: VAQT });

  assert.ok(Buffer.isBuffer(fayl.buffer));
  assert.equal(fayl.buffer.subarray(0, 2).toString(), 'PK', 'zip imzosi');
  assert.ok(fayl.buffer.length > 2000, `hajmi: ${fayl.buffer.length}`);
  assert.equal(fayl.qatorlar, 5);
  assert.match(fayl.nom, /^daftar-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const ichi = fayl.buffer.toString('latin1');
  for (const qism of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml', 'xl/styles.xml']) {
    assert.ok(ichi.includes(qism), `${qism} yo‘q`);
  }
});

sinov('hisobot: Excel bo‘sh daftarda ham yiqilmaydi', () => {
  const fayl = excelTuzish([], { vaqtMintaqasi: VAQT });
  assert.equal(fayl.buffer.subarray(0, 2).toString(), 'PK');
  assert.equal(fayl.qatorlar, 0);
});

sinov('hisobot: excel_hisobot vositasi faylni ktx ga qo‘shadi', () => {
  const d = namunaviyDaftar('h2.json');
  const k = ktx(d);

  const hammasi = vositaniBajarish('excel_hisobot', { oy: null, holat: 'hammasi' }, k);
  assert.equal(hammasi.ok, true);
  assert.equal(hammasi.qatorlar, 5);
  assert.equal(k.fayllar.length, 1);

  const ochiq = vositaniBajarish('excel_hisobot', { oy: '2026-09', holat: 'ochiq' }, k);
  assert.equal(ochiq.qatorlar, 3, 'Jasur qaytardi, Nodir sotuv — qolgani 3 ta');
  assert.equal(k.fayllar.length, 2);
  assert.match(k.fayllar[1].nom, /daftar-2026-09-/);

  const yoq = vositaniBajarish('excel_hisobot', { oy: '2030-01', holat: 'hammasi' }, k);
  assert.equal(yoq.qatorlar, 0);
  assert.equal(k.fayllar.length, 2, 'bo‘sh natijada fayl yuborilmaydi');

  const yomonOy = vositaniBajarish('excel_hisobot', { oy: '2026-9', holat: 'hammasi' }, k);
  assert.equal(yomonOy.ok, false);
});

sinov('hisobot: oylik xulosa uch bo‘limni ham ko‘rsatadi', () => {
  const d = namunaviyDaftar('h3.json');
  const matn = oylikHisobotMatni(d.yozuvlar, '2026-09', VAQT);

  assert.match(matn, /Sentabr 2026/);
  assert.match(matn, /Berildi:<\/b> 4 ta/, 'sotuv "berildi" ichida sanalmaydi');
  assert.match(matn, /Sotildi:<\/b> 1 ta/, 'sotuv alohida bo\u2018limda');
  assert.match(matn, /Qaytarildi:<\/b> 1 ta/, 'faqat Jasur qaytardi');
  assert.match(matn, /Qaytarilmadi:<\/b> 3 ta/);
  assert.ok(matn.includes('Sardor') && matn.includes('Akmal'), 'qarzdorlar ko‘rinadi');
  assert.ok(matn.includes('USD'), 'valyutalar alohida sanaladi');
  assert.ok(matn.includes('12 000 000'), 'summa formatlangan');
});

sinov('hisobot: oylik xulosa bo‘sh oyda ham ishlaydi', () => {
  const d = namunaviyDaftar('h4.json');
  const matn = oylikHisobotMatni(d.yozuvlar, '2025-01', VAQT);
  assert.match(matn, /Yanvar 2025/);
  assert.match(matn, /Berildi:<\/b> 0 ta/);
  assert.ok(!matn.includes('Sotildi'), 'savdo bo\u2018lmagan oyda bo\u2018lim ko\u2018rsatilmaydi');
});

sinov('hisobot: ochiqlar ro‘yxati kechikkanlarni ajratadi', () => {
  const d = namunaviyDaftar('h5.json');
  const matn = ochiqlarMatni(d.yozuvlar, VAQT);
  assert.match(matn, /Qaytarilmaganlar — 3 ta/);
  assert.ok(!matn.includes('Jasur'), 'qaytargan odam ro‘yxatda yo‘q');
  assert.ok(!matn.includes('Nodir'), 'sotuv ro‘yxatda yo‘q');

  assert.equal(ochiqlarMatni([], VAQT).includes('daftar toza'), true);
});

sinov('hisobot: qisqaSatr hamma maydonni jamlaydi', () => {
  const satr = qisqaSatr({
    id: 'Y0007', kim: 'Sardor', nima: 'UZI', summa: 12000000,
    valyuta: 'UZS', qaytarish_sanasi: '2026-10-01',
  });
  assert.match(satr, /Y0007/);
  assert.match(satr, /Sardor/);
  assert.match(satr, /12 000 000 UZS/);
  assert.match(satr, /01\.10\.2026 gacha/);
});

/* ================================================================== */
/* eslatma                                                             */
/* ================================================================== */

sinov('eslatma: muddati kelganlar to‘g‘ri tanlanadi', () => {
  const d = namunaviyDaftar('e1.json');
  const royxat = muddatiKelganlar(d.yozuvlar, '2026-09-25');

  const idlar = royxat.map((y) => y.id);
  assert.deepEqual(idlar, ['Y0001'], 'faqat Sardor (25-sentabr), Jasur qaytargan');

  const keyinroq = muddatiKelganlar(d.yozuvlar, '2026-10-15');
  assert.deepEqual(keyinroq.map((y) => y.id), ['Y0001', 'Y0003', 'Y0004'], 'sana bo‘yicha tartibda');

  assert.deepEqual(muddatiKelganlar(d.yozuvlar, '2026-01-01'), [], 'muddat kelmagan');
});

sinov('eslatma: matn va tugmalar', () => {
  const d = namunaviyDaftar('e2.json');
  const royxat = muddatiKelganlar(d.yozuvlar, '2026-10-15');

  const matn = eslatmaMatni(royxat, '2026-10-15');
  assert.match(matn, /Eslatma — 15\.10\.2026/);
  assert.match(matn, /Muddati o‘tgan \(3\)/);
  assert.match(matn, /kun kechikdi/);

  const tg = tugmalar(royxat);
  assert.equal(tg.inline_keyboard.length, 3);
  assert.equal(tg.inline_keyboard[0][0].callback_data, 'q:Y0001');
  for (const [tugma] of tg.inline_keyboard) {
    assert.ok(Buffer.byteLength(tugma.callback_data) <= 64, 'callback_data 64 baytdan oshmasin');
    assert.ok(tugma.text.length <= 60);
  }

  const kop = tugmalar(Array.from({ length: 50 }, (_, i) => ({ id: `Y${i}`, kim: 'X', nima: null })));
  assert.equal(kop.inline_keyboard.length, 20, 'tugmalar soni cheklangan');
});

/* ================================================================== */
/* telegram                                                            */
/* ================================================================== */

sinov('telegram: esc HTML ni zararsizlantiradi', () => {
  assert.equal(esc('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(esc('a & b'), 'a &amp; b');
  assert.equal(esc(null), '');
  assert.equal(esc("Sardor's <script>"), 'Sardor\'s &lt;script&gt;');
});


/* ================================================================== */
/* miya: DeepSeek (soxta fetch bilan)                                  */
/* ================================================================== */

const DS_CFG = {
  ...CFG,
  xizmat: 'deepseek',
  model: 'deepseek-chat',
  deepseekKalit: 'sk-sinov',
  deepseekAsos: 'https://api.deepseek.com',
  tasdiqDaqiqa: 10,
};

/** globalThis.fetch ni vaqtincha almashtiradi */
async function fetchOrnida(javobBeruvchi, ish) {
  const asl = globalThis.fetch;
  const chaqiruvlar = [];
  globalThis.fetch = async (url, sozlama) => {
    chaqiruvlar.push({ url: String(url), sozlama, tana: JSON.parse(sozlama.body) });
    return javobBeruvchi(chaqiruvlar.length);
  };
  try {
    return { natija: await ish(chaqiruvlar), chaqiruvlar };
  } finally {
    globalThis.fetch = asl;
  }
}

const dsJavob = (tana, holat = 200) => new Response(JSON.stringify(tana), {
  status: holat,
  headers: { 'content-type': 'application/json' },
});

const dsXabar = (content, toolCalls = null) => ({
  choices: [{
    message: { role: 'assistant', content, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
    finish_reason: toolCalls ? 'tool_calls' : 'stop',
  }],
});

sinov('deepseek: so‘rov OpenAI shaklida yuboriladi', async () => {
  const miya = miyaYaratish(DS_CFG);
  assert.equal(miya.nomi, 'deepseek');

  const { chaqiruvlar } = await fetchOrnida(
    () => dsJavob(dsXabar('Tayyor.')),
    async () => {
      const messages = miya.tayyorlash({ yoriqnoma: 'YO‘RIQNOMA', tarix: [], xabar: 'salom' });
      return miya.sorov({ messages, vositalar: VOSITALAR });
    },
  );

  const s = chaqiruvlar[0];
  assert.equal(s.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(s.sozlama.headers.authorization, 'Bearer sk-sinov');
  assert.equal(s.tana.model, 'deepseek-chat');
  assert.equal(s.tana.tool_choice, 'auto');
  assert.equal(s.tana.temperature, 0);
  assert.equal(s.tana.messages[0].role, 'system');
  assert.equal(s.tana.messages[0].content, 'YO‘RIQNOMA');
  assert.equal(s.tana.messages.at(-1).content, 'salom');

  // vositalar OpenAI "function" shaklida
  assert.equal(s.tana.tools.length, VOSITALAR.length);
  for (const v of s.tana.tools) {
    assert.equal(v.type, 'function');
    assert.ok(v.function.name && v.function.description);
    assert.equal(v.function.parameters.type, 'object');
    assert.equal(v.function.parameters.additionalProperties, false);
  }
  assert.ok(s.tana.tools.some((v) => v.function.name === 'yozuv_qoshish'));
});

sinov('deepseek: tool_calls normallashtiriladi', async () => {
  const miya = miyaYaratish(DS_CFG);
  const { natija } = await fetchOrnida(
    () => dsJavob(dsXabar(null, [{
      id: 'call_1',
      type: 'function',
      function: { name: 'yozuv_qoshish', arguments: '{"kim":"Sardor","summa":5000000}' },
    }])),
    async () => miya.sorov({ messages: [], vositalar: VOSITALAR }),
  );

  assert.equal(natija.tugash, 'tool');
  assert.equal(natija.matn, '');
  assert.equal(natija.chaqiruvlar.length, 1);
  assert.equal(natija.chaqiruvlar[0].id, 'call_1');
  assert.equal(natija.chaqiruvlar[0].nom, 'yozuv_qoshish');
  assert.deepEqual(natija.chaqiruvlar[0].kirish, { kim: 'Sardor', summa: 5000000 });
});

sinov('deepseek: buzuq JSON argument vositani yiqitmaydi', async () => {
  const miya = miyaYaratish(DS_CFG);
  const { natija } = await fetchOrnida(
    () => dsJavob(dsXabar(null, [{
      id: 'call_1', type: 'function',
      function: { name: 'yozuv_qoshish', arguments: '{"kim":"Sardor",,,' },
    }])),
    async () => miya.sorov({ messages: [], vositalar: VOSITALAR }),
  );

  assert.ok('__buzuqJson' in natija.chaqiruvlar[0].kirish);
  const d = new Daftar(path.join(papka, 'ds-buzuq.json'));
  const javob = vositaniBajarish('yozuv_qoshish', natija.chaqiruvlar[0].kirish, ktx(d));
  assert.equal(javob.ok, false);
  assert.match(javob.xato, /JSON/);
  assert.equal(d.yozuvlar.length, 0);
});

sinov('deepseek: xato kodlari tushunarli xabarga aylanadi', async () => {
  const miya = miyaYaratish(DS_CFG);
  const holatlar = [
    [401, /kalit|noto/i],
    [402, /balans/i],
    [429, /chegara/i],
    [500, /nosozlik/i],
  ];
  for (const [kod, naqsh] of holatlar) {
    await assert.rejects(
      () => fetchOrnida(
        () => new Response('{"error":"x"}', { status: kod }),
        async () => miya.sorov({ messages: [], vositalar: VOSITALAR }),
      ),
      (e) => {
        assert.ok(e instanceof MiyaXatosi, `${kod}: MiyaXatosi emas`);
        assert.match(e.message, naqsh);
        return true;
      },
      `HTTP ${kod}`,
    );
  }
});

sinov('deepseek: JSON bo‘lmagan javob aniq xato beradi', async () => {
  const miya = miyaYaratish(DS_CFG);
  await assert.rejects(
    () => fetchOrnida(
      () => new Response('<html>proksi bloklandi</html>', { status: 200 }),
      async () => miya.sorov({ messages: [], vositalar: VOSITALAR }),
    ),
    (e) => {
      assert.match(e.message, /JSON emas/);
      return true;
    },
  );
});

sinov('deepseek: suhbat tarixi to‘g‘ri to‘planadi', () => {
  const miya = miyaYaratish(DS_CFG);
  const messages = miya.tayyorlash({ yoriqnoma: 'Y', tarix: [], xabar: 'salom' });

  miya.javobniQoshish(messages, {
    role: 'assistant', content: null,
    tool_calls: [{ id: 'c1', type: 'function', function: { name: 'f', arguments: '{}' } }],
  });
  miya.natijalarniQoshish(messages, [{ id: 'c1', nom: 'f', matn: '{"ok":true}', xato: false }]);

  assert.equal(messages.at(-2).role, 'assistant');
  assert.equal(messages.at(-2).content, '', 'null content bo‘sh satrga aylanadi');
  assert.equal(messages.at(-1).role, 'tool');
  assert.equal(messages.at(-1).tool_call_id, 'c1');
  assert.equal(messages.at(-1).content, '{"ok":true}');
});

/* ================================================================== */
/* agent sikli                                                         */
/* ================================================================== */

/** Oldindan tayyorlangan javoblarni navbat bilan qaytaradigan soxta miya */
function soxtaMiya(javoblar) {
  const sorovlar = [];
  return {
    nomi: 'soxta',
    sorovlar,
    tayyorlash({ yoriqnoma, tarix, xabar }) {
      this.yoriqnoma = yoriqnoma;
      return [...tarix.map((x) => ({ ...x })), { role: 'user', content: xabar }];
    },
    async sorov({ messages, vositalar }) {
      sorovlar.push({ messages: [...messages], vositalar });
      const javob = javoblar.shift();
      if (!javob) throw new Error('Soxta miyada javob qolmadi — sikl to‘xtamagan');
      return javob;
    },
    javobniQoshish(messages, xom) { messages.push({ role: 'assistant', content: xom }); },
    natijalarniQoshish(messages, natijalar) { messages.push({ role: 'tool', content: natijalar }); },
  };
}

const chaqiruv = (nom, kirish, id = 'c1') => ({
  tugash: 'tool', matn: '', chaqiruvlar: [{ id, nom, kirish }], xom: { nom, kirish },
});
const tugadi = (matn) => ({ tugash: 'end', matn, chaqiruvlar: [], xom: null });

function sinovAgenti(nom, javoblar, qoshimchaCfg = {}) {
  const daftar = new Daftar(path.join(papka, nom));
  const agent = new Agent({ ...DS_CFG, ...qoshimchaCfg }, daftar);
  const miya = soxtaMiya(javoblar);
  agent.miya = miya;
  return { daftar, agent, miya };
}

const YOZUV_KIRISHI = {
  turi: 'apparat_qarz', kim: 'Sardor', nima: 'UZI apparati',
  summa: 12000000, valyuta: 'UZS', berilgan_sana: '2026-09-15',
  qaytarish_sanasi: '2026-10-01', izoh: null,
};

sinov('agent: vosita chaqiruvi → natija → javob sikli ishlaydi', async () => {
  const { daftar, agent, miya } = sinovAgenti('a1.json', [
    chaqiruv('yozuv_qoshish', YOZUV_KIRISHI),
    tugadi('Saqladim: Sardor — UZI apparati, 12 mln, 1-oktabrgacha.'),
  ]);

  const natija = await agent.javob({ chatId: 42, matn: 'Sardorga UZI berdim, 12 mln, 1-oktabrgacha' });

  assert.equal(daftar.yozuvlar.length, 1);
  assert.equal(daftar.yozuvlar[0].kim, 'Sardor');
  assert.equal(daftar.yozuvlar[0].qaytarish_sanasi, '2026-10-01');
  assert.match(natija.javob, /Saqladim/);
  assert.equal(miya.sorovlar.length, 2);

  const ikkinchi = miya.sorovlar[1].messages;
  assert.equal(ikkinchi.at(-2).role, 'assistant');
  assert.equal(ikkinchi.at(-1).role, 'tool');
  assert.equal(JSON.parse(ikkinchi.at(-1).content[0].matn).ok, true);

  const tarix = daftar.tarix(42);
  assert.equal(tarix.length, 2);
  assert.equal(tarix[0].role, 'user');
});

sinov('agent: kontekst bloki oxirgi xabarga qo‘shiladi', async () => {
  const { agent, miya } = sinovAgenti('a2.json', [tugadi('Tushundim.')]);
  await agent.javob({ chatId: 1, matn: 'salom' });

  const s = miya.sorovlar[0];
  assert.equal(s.vositalar.length, VOSITALAR.length);
  assert.equal(s.messages[0].role, 'user');
  assert.match(s.messages.at(-1).content, /<kontekst>/);
  assert.match(s.messages.at(-1).content, /Bugun: \d{4}-\d{2}-\d{2}/);
  assert.match(s.messages.at(-1).content, /salom$/);
  assert.match(miya.yoriqnoma, /shaxsiy hisob-kitob daftarini/);
});

sinov('agent: vosita xatosi belgilanadi, sikl davom etadi', async () => {
  const { daftar, agent, miya } = sinovAgenti('a4.json', [
    chaqiruv('qaytarildi_belgilash', { id: 'Y9999', sana: null, summa: null, izoh: null }),
    tugadi('Bunday yozuv topilmadi, kimni nazarda tutdingiz?'),
  ]);

  const natija = await agent.javob({ chatId: 5, matn: 'Falonchi qaytardi' });
  const natijaBloki = miya.sorovlar[1].messages.at(-1).content[0];
  assert.equal(natijaBloki.xato, true);
  assert.equal(JSON.parse(natijaBloki.matn).ok, false);
  assert.match(natija.javob, /topilmadi/);
  assert.equal(daftar.yozuvlar.length, 0);
});

sinov('agent: Excel vositasi natijasi fayl bo‘lib qaytadi', async () => {
  const { daftar, agent } = sinovAgenti('a5.json', [
    chaqiruv('excel_hisobot', { oy: null, holat: 'hammasi' }),
    tugadi('Mana hisobot.'),
  ]);
  daftar.qoshish({ kim: 'Sardor', turi: 'pul_qarz', summa: 1000, berilgan_sana: '2026-09-01' });

  const natija = await agent.javob({ chatId: 9, matn: 'excel ber' });
  assert.equal(natija.fayllar.length, 1);
  assert.equal(natija.fayllar[0].buffer.subarray(0, 2).toString(), 'PK');
});

sinov('agent: cheksiz siklga tushmaydi', async () => {
  const cheksiz = Array.from({ length: 20 }, () => chaqiruv('yozuvlarni_qidirish', {
    kim: null, matn: null, turi: 'hammasi', holat: 'hammasi', sana_dan: null, sana_gacha: null,
  }));
  const { agent, miya } = sinovAgenti('a6.json', cheksiz);
  const natija = await agent.javob({ chatId: 3, matn: 'qidir' });
  assert.ok(miya.sorovlar.length <= 8, `chaqiruvlar soni: ${miya.sorovlar.length}`);
  assert.ok(natija.javob.length > 0);
});

sinov('agent: refusal va max holatlari yumshoq tugaydi', async () => {
  const rad = sinovAgenti('a7.json', [{ tugash: 'refusal', matn: '', chaqiruvlar: [], xom: null }]);
  assert.ok((await rad.agent.javob({ chatId: 1, matn: 'test' })).javob.length > 0);

  const kesilgan = sinovAgenti('a8.json', [{ tugash: 'max', matn: 'Yarim javob', chaqiruvlar: [], xom: null }]);
  assert.match((await kesilgan.agent.javob({ chatId: 1, matn: 'test' })).javob, /kesildi/);
});

/* ================================================================== */
/* ovozdan yozilgan yozuvni tasdiqlash                                 */
/* ================================================================== */

sinov('tasdiq: ovozdan kelgan yozuv kutish holatida saqlanadi', async () => {
  const { daftar, agent } = sinovAgenti('t1.json', [
    chaqiruv('yozuv_qoshish', YOZUV_KIRISHI),
    tugadi('Saqladim.'),
  ]);

  const oldin = Date.now();
  const natija = await agent.javob({ chatId: 1, matn: 'Sardorga UZI berdim', manba: 'ovoz' });

  assert.equal(natija.yangiYozuvlar.length, 1, 'yangi yozuv qaytariladi');
  const y = daftar.yozuvlar[0];
  assert.equal(y.tasdiq, 'kutilmoqda');
  assert.equal(y.manba, 'ovoz');
  const muddat = Date.parse(y.tasdiqMuddati);
  assert.ok(muddat >= oldin + 9 * 60000 && muddat <= Date.now() + 11 * 60000, 'muddat ~10 daqiqa');
});

sinov('tasdiq: yozma xabar darrov tasdiqlangan hisoblanadi', async () => {
  const { daftar, agent } = sinovAgenti('t2.json', [
    chaqiruv('yozuv_qoshish', YOZUV_KIRISHI),
    tugadi('Saqladim.'),
  ]);
  await agent.javob({ chatId: 1, matn: 'Sardorga UZI berdim' });

  assert.equal(daftar.yozuvlar[0].tasdiq, 'tasdiqlangan');
  assert.equal(daftar.yozuvlar[0].tasdiqMuddati, null);
  assert.equal(daftar.kutilayotganlar().length, 0);
});

sinov('tasdiq: muddat o‘tgach jim qolingani uchun tasdiqlanadi', async () => {
  const daftar = new Daftar(path.join(papka, 't3.json'));
  const hali = daftar.qoshish({
    kim: 'Sardor', turi: 'pul_qarz', summa: 1000, berilgan_sana: '2026-09-01',
    tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() + 5 * 60000).toISOString(),
    tasdiqChatId: 77, tasdiqXabarId: 555,
  });
  const otgan = daftar.qoshish({
    kim: 'Jasur', turi: 'pul_qarz', summa: 2000, berilgan_sana: '2026-09-02',
    tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() - 60000).toISOString(),
    tasdiqChatId: 77, tasdiqXabarId: 556,
  });

  assert.equal(daftar.kutilayotganlar().length, 2);
  assert.deepEqual(daftar.muddatiOtganTasdiqlar().map((y) => y.id), [otgan.id]);

  const tahrirlar = [];
  const soxtaTelegram = {
    editMessageReplyMarkup: async (chat, xabar) => { tahrirlar.push([chat, xabar]); },
  };

  const yopilgan = await tasdiqlarniYopish(daftar, soxtaTelegram);
  assert.equal(yopilgan.length, 1);
  assert.equal(daftar.topish(otgan.id).tasdiq, 'tasdiqlangan');
  assert.equal(daftar.topish(otgan.id).tasdiqMuddati, null);
  assert.equal(daftar.topish(hali.id).tasdiq, 'kutilmoqda', 'muddati kelmagani tegilmaydi');
  assert.deepEqual(tahrirlar, [[77, 556]], 'faqat o‘sha xabarning tugmalari olindi');

  // qayta chaqirish zarar qilmaydi
  assert.equal((await tasdiqlarniYopish(daftar, soxtaTelegram)).length, 0);
});

sinov('tasdiq: egasi tuzatsa yozuv darrov tasdiqlanadi', async () => {
  const daftar = new Daftar(path.join(papka, 't4.json'));
  const y = daftar.qoshish({
    kim: 'Sardor', turi: 'pul_qarz', summa: 5000000, berilgan_sana: '2026-09-01',
    tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() + 9 * 60000).toISOString(),
  });

  const javob = vositaniBajarish('yozuvni_yangilash', {
    id: y.id, kim: 'Sardorbek', nima: null, summa: null,
    valyuta: null, berilgan_sana: null, qaytarish_sanasi: null, izoh: null,
  }, ktx(daftar));

  assert.equal(javob.ok, true);
  assert.equal(daftar.topish(y.id).kim, 'Sardorbek');
  assert.equal(daftar.topish(y.id).tasdiq, 'tasdiqlangan');
  assert.equal(daftar.kutilayotganlar().length, 0);
});

sinov('tasdiq: "To‘g‘ri" tugmasi hammasini tasdiqlaydi', async () => {
  const daftar = new Daftar(path.join(papka, 't5.json'));
  for (const kim of ['A', 'B']) {
    daftar.qoshish({
      kim, turi: 'pul_qarz', summa: 100, berilgan_sana: '2026-09-01',
      tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() + 9 * 60000).toISOString(),
    });
  }

  const javoblar = [];
  const soxtaTelegram = {
    answerCallbackQuery: async (id, matn) => javoblar.push(matn),
    editMessageReplyMarkup: async () => {},
    sendMessage: async () => ({ message_id: 1 }),
  };
  const cfg = { ...DS_CFG, egaId: 7 };

  await tugmaniIshlash(
    { id: 'cb1', from: { id: 7 }, data: 't:*', message: { chat: { id: 7 }, message_id: 10 } },
    { telegram: soxtaTelegram, daftar, cfg },
  );

  assert.equal(daftar.kutilayotganlar().length, 0);
  assert.match(javoblar[0], /2 ta/);
});

sinov('tasdiq: "O‘chirish" tugmasi yozuvni olib tashlaydi', async () => {
  const daftar = new Daftar(path.join(papka, 't6.json'));
  const y = daftar.qoshish({
    kim: 'Xato eshitilgan', turi: 'pul_qarz', summa: 100, berilgan_sana: '2026-09-01',
    tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() + 9 * 60000).toISOString(),
  });

  const yuborilgan = [];
  const soxtaTelegram = {
    answerCallbackQuery: async () => {},
    editMessageReplyMarkup: async () => {},
    sendMessage: async (chat, matn) => { yuborilgan.push(matn); return { message_id: 1 }; },
  };

  await tugmaniIshlash(
    { id: 'cb', from: { id: 7 }, data: `o:${y.id}`, message: { chat: { id: 7 }, message_id: 10 } },
    { telegram: soxtaTelegram, daftar, cfg: { ...DS_CFG, egaId: 7 } },
  );

  assert.equal(daftar.yozuvlar.length, 0);
  assert.match(yuborilgan[0], /chirildi/);
});

sinov('tasdiq: begona odam tugmani bosa olmaydi', async () => {
  const daftar = new Daftar(path.join(papka, 't7.json'));
  const y = daftar.qoshish({
    kim: 'A', turi: 'pul_qarz', summa: 100, berilgan_sana: '2026-09-01',
    tasdiq: 'kutilmoqda', tasdiqMuddati: new Date(Date.now() + 9 * 60000).toISOString(),
  });

  const javoblar = [];
  await tugmaniIshlash(
    { id: 'cb', from: { id: 999 }, data: `o:${y.id}`, message: { chat: { id: 999 }, message_id: 1 } },
    {
      telegram: { answerCallbackQuery: async (id, m) => javoblar.push(m) },
      daftar,
      cfg: { ...DS_CFG, egaId: 7 },
    },
  );

  assert.equal(daftar.yozuvlar.length, 1, 'yozuv o‘chmadi');
  assert.match(javoblar[0], /Ruxsat/);
});

sinov('tasdiq: kutayotgan yozuv ro‘yxatda belgi bilan ko‘rinadi', () => {
  const satr = qisqaSatr({ id: 'Y0001', kim: 'Sardor', tasdiq: 'kutilmoqda' });
  assert.match(satr, /Y0001 ⏳/);
  assert.ok(!qisqaSatr({ id: 'Y0002', kim: 'A', tasdiq: 'tasdiqlangan' }).includes('⏳'));
});

/* ================================================================== */
/* ovoz: fayl nomini xizmatlar tushunadigan qilish                     */
/* ================================================================== */

sinov('ovoz: Telegram .oga ni .ogg ga aylantiradi', () => {
  // Groq ruxsat ro'yxatida "oga" yo'q, "ogg" bor - tarkibi esa bir xil
  assert.deepEqual(faylniTayyorlash('file_123.oga'), { nom: 'file_123.ogg', tur: 'audio/ogg' });
  assert.deepEqual(faylniTayyorlash('A.OGA'), { nom: 'A.ogg', tur: 'audio/ogg' });
});

sinov('ovoz: papka yo\u2018li olib tashlanadi', () => {
  assert.equal(faylniTayyorlash('voice/file_9.oga').nom, 'file_9.ogg');
  assert.equal(faylniTayyorlash('a/b/c/ovoz.ogg').nom, 'ovoz.ogg');
});

sinov('ovoz: tanish turlar o\u2018zgarmaydi', () => {
  const holatlar = [
    ['qoshiq.mp3', 'audio/mpeg'],
    ['yozuv.m4a', 'audio/mp4'],
    ['x.wav', 'audio/wav'],
    ['y.webm', 'audio/webm'],
    ['z.flac', 'audio/flac'],
    ['w.opus', 'audio/ogg'],
  ];
  for (const [nom, tur] of holatlar) {
    const natija = faylniTayyorlash(nom);
    assert.equal(natija.nom, nom, nom);
    assert.equal(natija.tur, tur, nom);
  }
});

sinov('ovoz: notanish yoki bo\u2018sh nom xavfsiz turga tushadi', () => {
  // Telegram ovozi doim Ogg/Opus - shuni sukut qilib olamiz
  assert.deepEqual(faylniTayyorlash('nomsiz'), { nom: 'nomsiz.ogg', tur: 'audio/ogg' });
  assert.deepEqual(faylniTayyorlash(''), { nom: 'audio.ogg', tur: 'audio/ogg' });
  assert.deepEqual(faylniTayyorlash(null), { nom: 'audio.ogg', tur: 'audio/ogg' });
  assert.equal(faylniTayyorlash('nimadir.xyz').nom, 'nimadir.ogg');
});

/* ================================================================== */

console.log('');
for (const [nom, fn] of sinovlar) {
  try {
    await fn();
    otdi += 1;
    console.log(`  ✓ ${nom}`);
  } catch (xato) {
    console.error(`  ✗ ${nom}\n      ${xato.message}`);
    fs.rmSync(papka, { recursive: true, force: true });
    process.exit(1);
  }
}

fs.rmSync(papka, { recursive: true, force: true });
console.log(`\n✅ ${otdi} ta sinovning hammasi o‘tdi\n`);
