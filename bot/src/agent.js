/**
 * Agent — til modeli bilan vositalar siklidan iborat.
 *
 * Qaysi model ishlatilishi (DeepSeek yoki Claude) `miya.js` da hal qilinadi;
 * bu yerdagi sikl ikkalasi uchun ham bir xil.
 */
import { VOSITALAR, vositaniBajarish } from './vositalar.js';
import { miyaYaratish, MiyaXatosi } from './miya.js';
import { TURLAR } from './store.js';
import { hozir, sanaKorinishi } from './vaqt.js';
import { qisqaSatr } from './hisobot.js';

const MAX_AYLANMA = 8;

const TIZIM_YORIQNOMASI = `Sen — bitta odamning shaxsiy hisob-kitob daftarini yuritadigan agentsan.
Egang senga o'zbek tilida yozma yoki ovozli xabar yuboradi: kimga qanday apparat berdi,
kim qancha pul qarz oldi, qachon qaytaradi, kim qaytardi. Sening ishing — bularni
vositalar orqali daftarga yozib borish, eslab qolish va so'ralganda hisobot berish.

YOZUV TURLARI:
${Object.entries(TURLAR).map(([kod, izoh]) => `  ${kod} — ${izoh}`).join('\n')}

ISH TARTIBI:
1. Yangi voqea aytilsa — darrov "yozuv_qoshish" chaqir. Avval so'rab o'tirma:
   ism va nima berilgani ma'lum bo'lsa, yozib qo'y.
2. "Falonchi qaytardi / to'ladi / apparatni olib keldi" deyilsa — avval
   "yozuvlarni_qidirish" (holat: "ochiq") bilan o'sha odamni top, keyin
   "qaytarildi_belgilash" chaqir. ID ni hech qachon o'zingdan to'qima.
3. Bir odamda bir nechta ochiq yozuv bo'lsa — o'zing tanlama. Ro'yxatni
   ko'rsatib, qaysi biri ekanini so'ra.
4. Xatoni tuzatish so'ralsa ("yo'q, 5 emas 6 mln edi") — "yozuvni_yangilash".
5. "yozuvni_ochirish" ni faqat egang aniq "o'chir" deganda chaqir.
6. Bir xabarda bir nechta voqea bo'lsa, har biri uchun alohida yozuv qo'sh.

SANALAR:
- Vositalarga sana faqat YYYY-MM-DD ko'rinishida beriladi.
- "ertaga", "indinga", "10 kundan keyin", "kelasi payshanba", "oy oxirigacha",
  "1-oktabrgacha", "2 haftadan keyin" — bularni bugungi sanaga qarab o'zing hisobla.
- Qaytarish sanasi umuman aytilmagan bo'lsa: qaytarish_sanasi = null qilib yoz,
  keyin javobingda "qachon qaytaradi?" deb so'ra.

SUMMALAR:
- Faqat raqam: "5 mln" -> 5000000, "500 ming" -> 500000, "2 yarim million" -> 2500000,
  "12 million so'm" -> 12000000, "300 dollar" -> 300 (valyuta: USD).
- Valyuta aytilmasa UZS.

JAVOB BERISH:
- Faqat o'zbek tilida, qisqa: 1-3 qator. Ortiqcha muqaddima yozma.
- Yozuv saqlangach nima yozilganini bir qatorda tasdiqla (ism, nima, summa, sana).
- Ovozdan o'girilgan matnda ism noto'g'ri eshitilgan bo'lishi mumkin. Ism g'alati
  tuyulsa ham yozib qo'y — bot egasiga tasdiqlash uchun alohida xabar yuboradi,
  sen bu haqda yozishing shart emas.
- Ism umuman aytilmagan bo'lsa ("bir odamga berdim") — yozma, kimligini so'ra.
- Excel yoki oylik hisobot vositasini chaqirgan bo'lsang, natijasi egangga alohida
  yuboriladi; javobingda uni takrorlama.`;

/** Har chaqiruvda yangilanadigan kichik kontekst — tizim yo'riqnomasi o'zgarmaydi */
function kontekstBloki(daftar, cfg) {
  const v = hozir(cfg.vaqtMintaqasi);
  const ochiq = daftar.yozuvlar.filter((y) => y.holat !== 'qaytarildi');

  const qatorlar = [
    '<kontekst>',
    `Bugun: ${v.sana} (${v.hafta}, ${sanaKorinishi(v.sana)}), soat ${String(v.soat).padStart(2, '0')}:${String(v.daqiqa).padStart(2, '0')}, ${cfg.vaqtMintaqasi}`,
    `Joriy oy: ${v.oyKodi}`,
    `Daftarda jami ${daftar.yozuvlar.length} ta yozuv, shundan ${ochiq.length} tasi qaytarilmagan.`,
  ];

  if (ochiq.length && ochiq.length <= 40) {
    qatorlar.push('Qaytarilmagan yozuvlar:');
    for (const y of ochiq) qatorlar.push(`  ${qisqaSatr(y)} [${y.turi}]`);
  } else if (ochiq.length > 40) {
    qatorlar.push('(Qaytarilmaganlar ko‘p — kerakli yozuvni yozuvlarni_qidirish bilan top.)');
  }

  qatorlar.push('</kontekst>');
  return qatorlar.join('\n');
}

export class Agent {
  constructor(cfg, daftar) {
    this.cfg = cfg;
    this.daftar = daftar;
    this.miya = miyaYaratish(cfg);
  }

  /**
   * @returns {Promise<{javob, fayllar, tayyorMatnlar, yangiYozuvlar}>}
   */
  async javob({ chatId, matn, manba = 'matn' }) {
    const ktx = {
      daftar: this.daftar,
      cfg: this.cfg,
      manba,
      aslMatn: matn,
      fayllar: [],
      tayyorMatnlar: [],
      yangiYozuvlar: [],
    };

    const messages = this.miya.tayyorlash({
      yoriqnoma: TIZIM_YORIQNOMASI,
      tarix: this.daftar.tarix(chatId),
      xabar: `${kontekstBloki(this.daftar, this.cfg)}\n\n${matn}`,
    });

    let javobMatni = '';

    for (let aylanma = 0; aylanma < MAX_AYLANMA; aylanma += 1) {
      const natija = await this.miya.sorov({ messages, vositalar: VOSITALAR });

      if (natija.matn) javobMatni = natija.matn;

      if (natija.tugash === 'refusal') {
        javobMatni = javobMatni || 'Bu so‘rovga javob bera olmadim. Boshqacha aytib ko‘ring.';
        break;
      }
      if (natija.tugash === 'max') {
        javobMatni = `${javobMatni}\n\n(Javob uzun bo‘lgani uchun kesildi.)`.trim();
        break;
      }
      if (natija.tugash !== 'tool' || !natija.chaqiruvlar.length) break;

      this.miya.javobniQoshish(messages, natija.xom);

      const natijalar = natija.chaqiruvlar.map((chaqiruv) => {
        const javob = vositaniBajarish(chaqiruv.nom, chaqiruv.kirish, ktx);
        console.log(`[vosita] ${chaqiruv.nom} -> ${javob.ok ? 'ok' : `XATO: ${javob.xato}`}`);
        return { id: chaqiruv.id, nom: chaqiruv.nom, matn: JSON.stringify(javob), xato: !javob.ok };
      });

      this.miya.natijalarniQoshish(messages, natijalar);
    }

    if (!javobMatni) javobMatni = 'Tayyor.';

    this.daftar.tarixgaQoshish(chatId, 'user', matn);
    this.daftar.tarixgaQoshish(chatId, 'assistant', javobMatni);

    return {
      javob: javobMatni,
      fayllar: ktx.fayllar,
      tayyorMatnlar: ktx.tayyorMatnlar,
      yangiYozuvlar: ktx.yangiYozuvlar,
    };
  }
}

/** Xatolarni odam tushunadigan o'zbekcha xabarga aylantiradi */
export function agentXatosi(xato) {
  if (xato instanceof MiyaXatosi) return xato.message;
  return `Xatolik: ${xato.message}`;
}
