/**
 * Agent — Claude bilan vositalar (tool use) siklidan iborat.
 *
 * Qo'lda yozilgan sikl ishlatilgan (SDK ning beta tool-runner'i emas), chunki
 * vositalar yon ta'sir beradi: Excel fayli va tayyor hisobot matnlari sikl
 * tugagach Telegramga alohida yuboriladi.
 */
import Anthropic from '@anthropic-ai/sdk';
import { VOSITALAR, vositaniBajarish } from './vositalar.js';
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
  tuyulsa, yozib qo'y va javobingda "ismni to'g'ri yozdimmi?" deb so'ra.
- Ism umuman aytilmagan bo'lsa ("bir odamga berdim") — yozma, kimligini so'ra.
- Excel yoki oylik hisobot vositasini chaqirgan bo'lsang, natijasi egangga alohida
  yuboriladi; javobingda uni takrorlama.`;

/** Har chaqiruvda yangilanadigan kichik kontekst — tizim yo'riqnomasi keshda qoladi */
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
    this.client = new Anthropic({ apiKey: cfg.anthropicKalit, maxRetries: 3 });
  }

  /**
   * @returns {Promise<{javob: string, fayllar: object[], tayyorMatnlar: string[]}>}
   */
  async javob({ chatId, matn, manba = 'matn' }) {
    const ktx = {
      daftar: this.daftar,
      cfg: this.cfg,
      manba,
      aslMatn: matn,
      fayllar: [],
      tayyorMatnlar: [],
    };

    const tarix = this.daftar.tarix(chatId);
    const messages = [
      ...tarix.map((x) => ({ role: x.role, content: x.content })),
      { role: 'user', content: `${kontekstBloki(this.daftar, this.cfg)}\n\n${matn}` },
    ];

    let javobMatni = '';

    for (let aylanma = 0; aylanma < MAX_AYLANMA; aylanma += 1) {
      const sorov = {
        model: this.cfg.model,
        max_tokens: 8000,
        system: [{ type: 'text', text: TIZIM_YORIQNOMASI, cache_control: { type: 'ephemeral' } }],
        tools: VOSITALAR,
        messages,
      };
      if (this.cfg.effort) sorov.output_config = { effort: this.cfg.effort };

      const natija = await this.client.messages.create(sorov);

      const matnlar = natija.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text.trim())
        .filter(Boolean);
      if (matnlar.length) javobMatni = matnlar.join('\n\n');

      if (natija.stop_reason === 'refusal') {
        javobMatni = javobMatni || 'Bu so‘rovga javob bera olmadim. Boshqacha aytib ko‘ring.';
        break;
      }
      if (natija.stop_reason === 'max_tokens') {
        javobMatni = `${javobMatni}\n\n(Javob uzun bo‘lgani uchun kesildi.)`.trim();
        break;
      }
      if (natija.stop_reason !== 'tool_use') break;

      const chaqiruvlar = natija.content.filter((b) => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: natija.content });

      const natijalar = chaqiruvlar.map((chaqiruv) => {
        // strict rejimida ham kirishni o'zimiz tekshiramiz
        const kirish = chaqiruv.input && typeof chaqiruv.input === 'object' ? chaqiruv.input : {};
        const javob = vositaniBajarish(chaqiruv.name, kirish, ktx);
        console.log(`[vosita] ${chaqiruv.name} -> ${javob.ok ? 'ok' : `XATO: ${javob.xato}`}`);
        return {
          type: 'tool_result',
          tool_use_id: chaqiruv.id,
          content: JSON.stringify(javob),
          ...(javob.ok ? {} : { is_error: true }),
        };
      });

      messages.push({ role: 'user', content: natijalar });
    }

    if (!javobMatni) javobMatni = 'Tayyor.';

    this.daftar.tarixgaQoshish(chatId, 'user', matn);
    this.daftar.tarixgaQoshish(chatId, 'assistant', javobMatni);

    return { javob: javobMatni, fayllar: ktx.fayllar, tayyorMatnlar: ktx.tayyorMatnlar };
  }
}

/** Anthropic xatolarini odam tushunadigan o'zbekcha xabarga aylantiradi */
export function agentXatosi(xato) {
  if (xato instanceof Anthropic.AuthenticationError) {
    return 'ANTHROPIC_API_KEY noto‘g‘ri yoki eskirgan. .env faylni tekshiring.';
  }
  if (xato instanceof Anthropic.RateLimitError) {
    return 'Hozir so‘rovlar chegarasiga yetdik. Bir daqiqadan keyin qayta yuboring.';
  }
  if (xato instanceof Anthropic.BadRequestError) {
    return `So‘rov noto‘g‘ri tuzildi: ${xato.message}`;
  }
  if (xato instanceof Anthropic.APIConnectionError) {
    return 'Internet yoki Anthropic xizmatiga ulanib bo‘lmadi. Qayta urinib ko‘ring.';
  }
  if (xato instanceof Anthropic.APIError) {
    return `Anthropic xatosi (${xato.status}): ${xato.message}`;
  }
  return `Xatolik: ${xato.message}`;
}
