/**
 * Eslatma jadvali.
 *
 * Har daqiqada bir marta tekshiradi. Kron kutubxonasi ishlatilmagan: shart
 * "bugun eslatma yuborilganmi?" degan yozuvga qarab tekshiriladi, shuning
 * uchun bot o'sha soatda o'chiq bo'lsa ham, yonganda eslatma baribir keladi.
 */
import { hozir, kunFarqi, oldingiOy, sanaKorinishi } from './vaqt.js';
import { oylikHisobotMatni, qisqaSatr } from './hisobot.js';
import { esc } from './telegram.js';

const DAQIQA = 60 * 1000;

/** Bugun va undan oldin qaytarilishi kerak bo'lgan, hali yopilmagan yozuvlar */
export function muddatiKelganlar(yozuvlar, bugungi) {
  return yozuvlar
    .filter((y) => y.holat !== 'qaytarildi' && y.qaytarish_sanasi && y.qaytarish_sanasi <= bugungi)
    .sort((a, b) => a.qaytarish_sanasi.localeCompare(b.qaytarish_sanasi));
}

export function eslatmaMatni(royxat, bugungi) {
  const bugun = royxat.filter((y) => y.qaytarish_sanasi === bugungi);
  const kechikkan = royxat.filter((y) => y.qaytarish_sanasi < bugungi);

  const qatorlar = [`\u{1F514} <b>Eslatma — ${esc(sanaKorinishi(bugungi))}</b>`];

  if (bugun.length) {
    qatorlar.push('', `<b>Bugun qaytarilishi kerak (${bugun.length})</b>`);
    for (const y of bugun) qatorlar.push(`   • ${esc(qisqaSatr(y))}`);
  }
  if (kechikkan.length) {
    qatorlar.push('', `⏰ <b>Muddati o‘tgan (${kechikkan.length})</b>`);
    for (const y of kechikkan) {
      qatorlar.push(`   • ${esc(qisqaSatr(y))} — ${kunFarqi(y.qaytarish_sanasi, bugungi)} kun kechikdi`);
    }
  }
  qatorlar.push('', 'Qaytargan bo‘lsa tugmasini bosing yoki ismini yozib "qaytardi" deng.');
  return qatorlar.join('\n');
}

/** Har bir yozuv uchun bitta "qaytardi" tugmasi (Telegram chegarasi: 100 tugma) */
export function tugmalar(royxat) {
  return {
    inline_keyboard: royxat.slice(0, 20).map((y) => [
      { text: `✅ ${y.kim}${y.nima ? ` — ${y.nima}` : ''}`.slice(0, 60), callback_data: `q:${y.id}` },
    ]),
  };
}

/**
 * Ovozdan yozilgan yozuvlar egasi jim qolganda o'zi tasdiqlanadi.
 * Tugmalar olib tashlanadi, shunda qaysi yozuv hali kutayotgani ko'rinib turadi.
 * @returns {Promise<object[]>} tasdiqlangan yozuvlar
 */
export async function tasdiqlarniYopish(daftar, telegram) {
  const otganlar = daftar.muddatiOtganTasdiqlar();
  const yopilgan = [];

  for (const yozuv of otganlar) {
    const yangi = daftar.tasdiqlash(yozuv.id);
    if (!yangi) continue;
    yopilgan.push(yangi);
    if (telegram && yozuv.tasdiqChatId && yozuv.tasdiqXabarId) {
      await telegram.editMessageReplyMarkup(yozuv.tasdiqChatId, yozuv.tasdiqXabarId);
    }
  }
  return yopilgan;
}

export function eslatmaniBoshlash({ daftar, telegram, cfg, chatId }) {
  const tekshir = async () => {
    try {
      // tasdiq muddati soatdan qat'i nazar tekshiriladi
      const yopilgan = await tasdiqlarniYopish(daftar, telegram);
      if (yopilgan.length) {
        console.log(`[tasdiq] ${yopilgan.length} ta yozuv jim qolinganligi uchun tasdiqlandi`);
      }

      const v = hozir(cfg.vaqtMintaqasi);
      if (v.soat < cfg.eslatmaSoati) return;

      // ── kunlik eslatma ──────────────────────────────────────────────
      if (daftar.baza.holat.oxirgiKunlikEslatma !== v.sana) {
        const royxat = muddatiKelganlar(daftar.yozuvlar, v.sana);
        if (royxat.length) {
          await telegram.sendMessage(chatId, eslatmaMatni(royxat, v.sana), {
            reply_markup: tugmalar(royxat),
          });
        }
        // yuborilmagan bo'lsa ham kunni belgilaymiz — kun davomida takrorlanmasin
        daftar.holatniYozish('oxirgiKunlikEslatma', v.sana);
      }

      // ── oylik hisobot (o'tgan oy bo'yicha) ──────────────────────────
      const kerakliOy = oldingiOy(v.oyKodi);
      if (daftar.baza.holat.oxirgiOylikHisobot !== kerakliOy) {
        const matn = oylikHisobotMatni(daftar.yozuvlar, kerakliOy, cfg.vaqtMintaqasi);
        await telegram.sendMessage(chatId, matn);
        daftar.holatniYozish('oxirgiOylikHisobot', kerakliOy);
      }
    } catch (xato) {
      console.error('[eslatma]', xato.message);
    }
  };

  const taymer = setInterval(tekshir, (cfg.tekshiruvSoniya || 60) * 1000);
  taymer.unref?.();
  tekshir();
  return () => clearInterval(taymer);
}
