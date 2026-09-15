/**
 * Ovozdan kelgan matnni o'zbek tiliga keltirish.
 *
 * Whisper o'zbek nutqini ba'zan turkcha yoki chala yozadi. Harflarni
 * almashtirish (asr.js) imloni tuzatadi, lekin so'zlar va ismlar baribir
 * noto'g'ri qolishi mumkin. Shuning uchun matn til modelidan bir marta
 * o'tkaziladi: u turkcha so'zlarni o'zbekchaga o'giradi va ismni tanish
 * ro'yxatiga yaqinlashtiradi.
 *
 * Bu qadam hech qachon ishni buzmasligi kerak — model javobi shubhali
 * bo'lsa, asl matn qaytariladi.
 */

const YORIQNOMA = `Sen o'zbek nutqining transkriptini tuzatuvchisan.

Kirish matni ovozdan olingan va xizmat uni turkcha yoki chala yozgan bo'lishi
mumkin. Vazifang — uni tabiiy o'zbek tiliga keltirish.

QOIDALAR:
1. Ma'noni o'zgartirma. Yangi gap, izoh, tushuntirish qo'shma.
2. Turkcha so'zlarni o'zbekchaga o'gir: iki->ikki, üç->uch, dört->to'rt,
   beş->besh, milyon->million, bin->ming, para->pul, borç->qarz, gün->kun,
   verdim->berdim, aldi->oldi, geri->qaytib, hafta->hafta.
3. Ismlar berilgan ro'yxatdan bo'lishi mumkin. Agar eshitilgan ism ro'yxatdagi
   birortasiga yaqin bo'lsa, ro'yxatdagisiga almashtir. Yaqin bo'lmasa tegma.
4. Raqamlar va sanalar qanday aytilgan bo'lsa, shunday qoldir.
5. Faqat tuzatilgan matnni yoz. Hech qanday izoh, tirnoq yoki sarlavha yozma.
6. Matn allaqachon to'g'ri o'zbekcha bo'lsa, uni o'zgarishsiz qaytar.`;

/**
 * @returns {Promise<{matn: string, ozgardi: boolean}>}
 */
export async function ovozniTozalash({ matn, ismlar = [], miya }) {
  const asl = String(matn ?? '').trim();
  if (!asl || !miya) return { matn: asl, ozgardi: false };

  const royxat = ismlar.slice(0, 40);
  const kirish = royxat.length
    ? `Tanish ismlar: ${royxat.join(', ')}\n\nMatn: ${asl}`
    : `Matn: ${asl}`;

  try {
    const messages = miya.tayyorlash({ yoriqnoma: YORIQNOMA, tarix: [], xabar: kirish });
    const javob = await miya.sorov({ messages, vositalar: [] });
    const tozalangan = tozalangandanOlish(javob.matn);

    if (!ishonchli(asl, tozalangan)) return { matn: asl, ozgardi: false };
    return { matn: tozalangan, ozgardi: tozalangan !== asl };
  } catch (xato) {
    // tozalash ixtiyoriy qadam - ishlamasa asl matn bilan davom etamiz
    console.warn(`[tozalash] o'tkazib yuborildi: ${xato.message}`);
    return { matn: asl, ozgardi: false };
  }
}

/** Model ba'zan tirnoq yoki "Matn:" qo'shib yuboradi — olib tashlaymiz */
function tozalangandanOlish(xom) {
  return String(xom ?? '')
    .trim()
    .replace(/^(tuzatilgan\s*matn|matn|natija)\s*:\s*/i, '')
    .replace(/^["'`“«]+|["'`”»]+$/g, '')
    .trim();
}

/**
 * Model gapni qisqartirib yoki uzaytirib yuborsa, ishonmaymiz.
 * Bu yerda ehtiyotkorlik afzal: noto'g'ri "tuzatish" asl matndan yomonroq.
 */
function ishonchli(asl, yangi) {
  if (!yangi) return false;
  if (yangi.includes('\n')) return false;              // izoh qo'shgan
  const nisbat = yangi.length / Math.max(1, asl.length);
  return nisbat >= 0.5 && nisbat <= 2;
}
