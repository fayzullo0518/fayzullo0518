/**
 * Agent vositalari (tools) — Claude shular orqali daftarga yozadi va o'qiydi.
 *
 * Har bir vosita `strict: true` bilan e'lon qilingan: Claude yuboradigan
 * argumentlar sxemaga aniq mos keladi. Shunga qaramay har bir ishlovchi
 * kelgan qiymatni yana bir bor tekshiradi va xatoni Claude tushunadigan
 * qilib qaytaradi — shunda u o'zini tuzatib qayta urinadi.
 */
import { TURLAR } from './store.js';
import { bugun, tugriIso, oyOraligi, sanaKorinishi } from './vaqt.js';
import { excelTuzish, oylikHisobotMatni, qisqaSatr } from './hisobot.js';

const TUR_KODLARI = Object.keys(TURLAR);
const VALYUTALAR = ['UZS', 'USD'];

const matnYoNull = { type: ['string', 'null'] };
const sonYoNull = { type: ['number', 'null'] };

/** strict rejimi uchun: barcha maydonlar `required`, qo'shimchalari taqiqlangan */
const sxema = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const VOSITALAR = [
  {
    name: 'yozuv_qoshish',
    description:
      'Daftarga yangi yozuv qo‘shadi: kimga nima berildi, qancha pul, qachon qaytariladi. ' +
      'Har bir yangi voqea uchun aynan bir marta chaqiriladi.',
    strict: true,
    input_schema: sxema({
      turi: {
        type: 'string',
        enum: TUR_KODLARI,
        description:
          'apparat_qarz = apparat berildi, puli keyin to‘lanadi. ' +
          'apparat_ijara = apparat vaqtincha ishlatishga berildi, o‘zi qaytariladi. ' +
          'pul_qarz = pul qarzga berildi. ' +
          'pul_oldim = men boshqadan qarz oldim. ' +
          'sotuv = sotildi va puli to‘liq olindi (darrov yopiladi).',
      },
      kim: { type: 'string', description: 'Odamning ismi (va agar aytilsa familiyasi)' },
      nima: { ...matnYoNull, description: 'Apparat yoki narsa nomi. Faqat pul bo‘lsa null' },
      summa: { ...sonYoNull, description: 'Faqat raqam: "5 mln" -> 5000000, "10 ming" -> 10000' },
      valyuta: { type: 'string', enum: VALYUTALAR, description: 'Aytilmasa UZS' },
      berilgan_sana: { type: 'string', description: 'YYYY-MM-DD. Aytilmasa bugungi sana' },
      qaytarish_sanasi: {
        ...matnYoNull,
        description: 'YYYY-MM-DD. Aytilmagan bo‘lsa null va keyin egasidan so‘ra',
      },
      izoh: { ...matnYoNull, description: 'Qo‘shimcha tafsilot bo‘lsa' },
    }),
  },
  {
    name: 'yozuvlarni_qidirish',
    description:
      'Daftardan yozuvlarni topadi. "Falonchi qaytardi" degan xabardan keyin ' +
      'ID ni bilish uchun avval shuni chaqir.',
    strict: true,
    input_schema: sxema({
      kim: { ...matnYoNull, description: 'Ism bo‘yicha qidirish (qismi ham bo‘ladi)' },
      matn: { ...matnYoNull, description: 'Ism, apparat nomi va izohlar ichidan qidirish' },
      turi: { type: 'string', enum: ['hammasi', ...TUR_KODLARI] },
      holat: { type: 'string', enum: ['hammasi', 'ochiq', 'qaytarildi', 'qisman'] },
      sana_dan: { ...matnYoNull, description: 'YYYY-MM-DD, berilgan sana shu kundan keyin' },
      sana_gacha: { ...matnYoNull, description: 'YYYY-MM-DD, berilgan sana shu kungacha' },
    }),
  },
  {
    name: 'qaytarildi_belgilash',
    description:
      'Yozuvni qaytarilgan deb belgilaydi. Summa ko‘rsatilsa va u qarzdan kam bo‘lsa, ' +
      'yozuv "qisman qaytarildi" holatiga o‘tadi.',
    strict: true,
    input_schema: sxema({
      id: { type: 'string', description: 'Yozuv ID si, masalan Y0007' },
      sana: { ...matnYoNull, description: 'YYYY-MM-DD. Aytilmasa bugungi sana' },
      summa: { ...sonYoNull, description: 'Qaytarilgan summa. To‘liq qaytarilgan bo‘lsa null' },
      izoh: { ...matnYoNull },
    }),
  },
  {
    name: 'yozuvni_yangilash',
    description:
      'Mavjud yozuvni tuzatadi (xato yozilgan ism, summa, sana). ' +
      'null qoldirilgan maydon o‘zgarmaydi.',
    strict: true,
    input_schema: sxema({
      id: { type: 'string' },
      kim: matnYoNull,
      nima: matnYoNull,
      summa: sonYoNull,
      valyuta: { type: ['string', 'null'], enum: [...VALYUTALAR, null] },
      berilgan_sana: { ...matnYoNull, description: 'YYYY-MM-DD' },
      qaytarish_sanasi: { ...matnYoNull, description: 'YYYY-MM-DD' },
      izoh: matnYoNull,
    }),
  },
  {
    name: 'yozuvni_ochirish',
    description:
      'Yozuvni butunlay o‘chiradi. Faqat egasi aniq "o‘chir" deganda chaqiriladi.',
    strict: true,
    input_schema: sxema({ id: { type: 'string' } }),
  },
  {
    name: 'excel_hisobot',
    description:
      'Excel (.xlsx) fayl tayyorlaydi va egasiga yuboradi. Uchta varaq: ' +
      'Hammasi, Qaytarilmagan, Qaytarilgan.',
    strict: true,
    input_schema: sxema({
      oy: { ...matnYoNull, description: 'YYYY-MM — faqat shu oy. Hammasi kerak bo‘lsa null' },
      holat: { type: 'string', enum: ['hammasi', 'ochiq', 'qaytarildi'] },
    }),
  },
  {
    name: 'oylik_hisobot',
    description:
      'Bir oy bo‘yicha xulosa: nima berildi, qaysilari qaytarildi, qaysilari qaytarilmadi.',
    strict: true,
    input_schema: sxema({
      oy: { type: 'string', description: 'YYYY-MM ko‘rinishida, masalan 2026-09' },
    }),
  },
];

/* ------------------------------------------------------------------ */
/* ishlovchilar                                                        */
/* ------------------------------------------------------------------ */

const xato = (xabar) => ({ ok: false, xato: xabar });

const bosh = (qiymat) => qiymat === null || qiymat === undefined || qiymat === '';

/** Claude ba'zan sonni matn qilib yuborishi mumkin — ehtiyot chorasi */
function sonGa(qiymat) {
  if (bosh(qiymat)) return null;
  const n = typeof qiymat === 'number' ? qiymat : Number(String(qiymat).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function sanaTekshir(qiymat, nom) {
  if (bosh(qiymat)) return { qiymat: null };
  if (!tugriIso(qiymat)) {
    return { xato: `${nom} noto‘g‘ri: "${qiymat}". YYYY-MM-DD ko‘rinishida bo‘lishi kerak.` };
  }
  return { qiymat };
}

/** Claude ga qaytariladigan ixcham ko'rinish */
const ixcham = (y) => ({
  id: y.id,
  turi: y.turi,
  kim: y.kim,
  nima: y.nima,
  summa: y.summa,
  valyuta: y.valyuta,
  berilgan_sana: y.berilgan_sana,
  qaytarish_sanasi: y.qaytarish_sanasi,
  holat: y.holat,
  qaytarilgan_sana: y.qaytarilgan_sana,
  qaytarilgan_summa: y.qaytarilgan_summa || 0,
});

export const ISHLOVCHILAR = {
  yozuv_qoshish(kirish, ktx) {
    const { daftar, cfg } = ktx;

    if (!TUR_KODLARI.includes(kirish.turi)) return xato(`Noma’lum turi: ${kirish.turi}`);
    const kim = String(kirish.kim || '').trim();
    if (!kim) return xato('Ism bo‘sh. Egasidan kimligini so‘ra.');

    const berilgan = sanaTekshir(kirish.berilgan_sana, 'berilgan_sana');
    if (berilgan.xato) return xato(berilgan.xato);
    const qaytarish = sanaTekshir(kirish.qaytarish_sanasi, 'qaytarish_sanasi');
    if (qaytarish.xato) return xato(qaytarish.xato);

    const berilganSana = berilgan.qiymat || bugun(cfg.vaqtMintaqasi);
    if (qaytarish.qiymat && qaytarish.qiymat < berilganSana) {
      return xato('Qaytarish sanasi berilgan sanadan oldin bo‘lishi mumkin emas. Sanani aniqlashtir.');
    }

    const yozuv = daftar.qoshish({
      turi: kirish.turi,
      kim,
      nima: bosh(kirish.nima) ? null : String(kirish.nima).trim(),
      summa: sonGa(kirish.summa),
      valyuta: VALYUTALAR.includes(kirish.valyuta) ? kirish.valyuta : cfg.valyuta,
      berilgan_sana: berilganSana,
      qaytarish_sanasi: qaytarish.qiymat,
      izoh: bosh(kirish.izoh) ? null : String(kirish.izoh).trim(),
      manba: ktx.manba || 'matn',
      asl_matn: ktx.aslMatn || null,
    });

    return { ok: true, yozuv: ixcham(yozuv), xabar: `Saqlandi: ${qisqaSatr(yozuv)}` };
  },

  yozuvlarni_qidirish(kirish, ktx) {
    const topilgan = ktx.daftar.qidirish({
      kim: bosh(kirish.kim) ? null : kirish.kim,
      matn: bosh(kirish.matn) ? null : kirish.matn,
      turi: kirish.turi && kirish.turi !== 'hammasi' ? kirish.turi : null,
      holat: kirish.holat && kirish.holat !== 'hammasi' ? kirish.holat : null,
      sana_dan: bosh(kirish.sana_dan) ? null : kirish.sana_dan,
      sana_gacha: bosh(kirish.sana_gacha) ? null : kirish.sana_gacha,
    });

    return {
      ok: true,
      soni: topilgan.length,
      yozuvlar: topilgan.slice(0, 40).map(ixcham),
      ...(topilgan.length > 40 ? { eslatma: 'Faqat birinchi 40 tasi ko‘rsatildi' } : {}),
    };
  },

  qaytarildi_belgilash(kirish, ktx) {
    const { daftar, cfg } = ktx;
    const yozuv = daftar.topish(kirish.id);
    if (!yozuv) return xato(`${kirish.id} ID li yozuv topilmadi. Avval yozuvlarni_qidirish bilan top.`);
    if (yozuv.holat === 'qaytarildi') {
      return { ok: true, allaqachon: true, yozuv: ixcham(yozuv), xabar: 'Bu yozuv allaqachon qaytarilgan deb belgilangan.' };
    }

    const sana = sanaTekshir(kirish.sana, 'sana');
    if (sana.xato) return xato(sana.xato);
    const qaytarilganSana = sana.qiymat || bugun(cfg.vaqtMintaqasi);

    const jamiSumma = typeof yozuv.summa === 'number' ? yozuv.summa : null;
    const oldin = yozuv.qaytarilgan_summa || 0;
    const kelgan = sonGa(kirish.summa);

    let holat = 'qaytarildi';
    let qaytarilganSumma = jamiSumma ?? 0;

    if (kelgan !== null && jamiSumma !== null) {
      qaytarilganSumma = oldin + kelgan;
      if (qaytarilganSumma < jamiSumma) holat = 'qisman';
      else qaytarilganSumma = Math.min(qaytarilganSumma, jamiSumma);
    } else if (kelgan !== null) {
      qaytarilganSumma = oldin + kelgan;
    }

    const yangi = daftar.yangilash(yozuv.id, {
      holat,
      qaytarilgan_sana: holat === 'qaytarildi' ? qaytarilganSana : yozuv.qaytarilgan_sana,
      qaytarilgan_summa: qaytarilganSumma,
      izoh: bosh(kirish.izoh) ? yozuv.izoh : [yozuv.izoh, kirish.izoh].filter(Boolean).join('; '),
    });

    return {
      ok: true,
      yozuv: ixcham(yangi),
      xabar: holat === 'qisman'
        ? `Qisman qaytarildi. Qoldiq: ${jamiSumma - qaytarilganSumma} ${yangi.valyuta}`
        : `${yangi.kim} — qaytarildi deb belgilandi (${sanaKorinishi(qaytarilganSana)}).`,
    };
  },

  yozuvni_yangilash(kirish, ktx) {
    const yozuv = ktx.daftar.topish(kirish.id);
    if (!yozuv) return xato(`${kirish.id} ID li yozuv topilmadi.`);

    const ozgarishlar = {};
    if (!bosh(kirish.kim)) ozgarishlar.kim = String(kirish.kim).trim();
    if (!bosh(kirish.nima)) ozgarishlar.nima = String(kirish.nima).trim();
    if (!bosh(kirish.izoh)) ozgarishlar.izoh = String(kirish.izoh).trim();
    if (!bosh(kirish.summa)) ozgarishlar.summa = sonGa(kirish.summa);
    if (!bosh(kirish.valyuta) && VALYUTALAR.includes(kirish.valyuta)) ozgarishlar.valyuta = kirish.valyuta;

    for (const maydon of ['berilgan_sana', 'qaytarish_sanasi']) {
      if (bosh(kirish[maydon])) continue;
      const tekshirilgan = sanaTekshir(kirish[maydon], maydon);
      if (tekshirilgan.xato) return xato(tekshirilgan.xato);
      ozgarishlar[maydon] = tekshirilgan.qiymat;
    }

    if (!Object.keys(ozgarishlar).length) return xato('Hech qanday o‘zgarish berilmadi.');

    const yangi = ktx.daftar.yangilash(kirish.id, ozgarishlar);
    return { ok: true, yozuv: ixcham(yangi), xabar: `Yangilandi: ${qisqaSatr(yangi)}` };
  },

  yozuvni_ochirish(kirish, ktx) {
    const ochirilgan = ktx.daftar.ochirish(kirish.id);
    if (!ochirilgan) return xato(`${kirish.id} ID li yozuv topilmadi.`);
    return { ok: true, xabar: `O‘chirildi: ${qisqaSatr(ochirilgan)}` };
  },

  excel_hisobot(kirish, ktx) {
    const { daftar, cfg } = ktx;
    let yozuvlar = daftar.yozuvlar;
    let qoshimcha = '';

    if (!bosh(kirish.oy)) {
      if (!/^\d{4}-\d{2}$/.test(kirish.oy)) return xato('oy YYYY-MM ko‘rinishida bo‘lishi kerak.');
      const { boshi, oxiri } = oyOraligi(kirish.oy);
      yozuvlar = yozuvlar.filter((y) => (y.berilgan_sana || '') >= boshi && (y.berilgan_sana || '') <= oxiri);
      qoshimcha = kirish.oy;
    }
    if (kirish.holat === 'ochiq') yozuvlar = yozuvlar.filter((y) => y.holat !== 'qaytarildi');
    if (kirish.holat === 'qaytarildi') yozuvlar = yozuvlar.filter((y) => y.holat === 'qaytarildi');

    if (!yozuvlar.length) return { ok: true, qatorlar: 0, xabar: 'Bu shart bo‘yicha yozuv yo‘q — fayl yuborilmadi.' };

    const fayl = excelTuzish(yozuvlar, { vaqtMintaqasi: cfg.vaqtMintaqasi, nomQoshimcha: qoshimcha });
    ktx.fayllar.push(fayl);

    return {
      ok: true,
      qatorlar: fayl.qatorlar,
      xabar: `Excel tayyor (${fayl.qatorlar} qator) va egasiga yuborilmoqda. Javobda faylni qayta ta’riflashning hojati yo‘q.`,
    };
  },

  oylik_hisobot(kirish, ktx) {
    if (!/^\d{4}-\d{2}$/.test(String(kirish.oy))) {
      return xato('oy YYYY-MM ko‘rinishida bo‘lishi kerak, masalan 2026-09.');
    }
    const matn = oylikHisobotMatni(ktx.daftar.yozuvlar, kirish.oy, ktx.cfg.vaqtMintaqasi);
    ktx.tayyorMatnlar.push(matn);
    return {
      ok: true,
      xabar: 'Oylik hisobot tayyorlandi va egasiga alohida xabar bilan yuboriladi. ' +
        'Javobda uni takrorlama — bir og‘iz izoh yetarli.',
    };
  },
};

/** Vositani chaqiradi; har qanday kutilmagan xato ham Claude ga matn bo'lib qaytadi */
export function vositaniBajarish(nom, kirish, ktx) {
  const ishlovchi = ISHLOVCHILAR[nom];
  if (!ishlovchi) return xato(`Noma’lum vosita: ${nom}`);
  try {
    return ishlovchi(kirish || {}, ktx);
  } catch (e) {
    console.error(`[vosita:${nom}]`, e);
    return xato(`Ichki xato: ${e.message}`);
  }
}
