/**
 * Doimiy xotira — oddiy JSON fayl.
 *
 * Yozuv hajmi kichik (shaxsiy daftar), shuning uchun baza butunligicha
 * xotirada turadi va har o'zgarishda diskka yoziladi. Yozish atomar:
 * avval .tmp faylga, keyin rename — elektr o'chsa ham fayl buzilmaydi.
 * Har muvaffaqiyatli yozuvdan oldin oldingi nusxa .bak ga ko'chiriladi.
 */
import fs from 'node:fs';
import path from 'node:path';

/** yozuv turlari — vositalar (tools) sxemasi bilan bir xil bo'lishi shart */
export const TURLAR = {
  apparat_qarz: 'Apparat berildi, puli keyin',
  apparat_ijara: 'Apparat vaqtincha berildi',
  pul_qarz: 'Pul qarzga berildi',
  pul_oldim: 'Men qarz oldim',
  sotuv: 'Sotildi, to‘liq to‘landi',
};

export const HOLATLAR = {
  ochiq: 'Qaytarilmagan',
  qisman: 'Qisman qaytarildi',
  qaytarildi: 'Qaytarildi',
};

const BOSH_BAZA = () => ({
  versiya: 1,
  ketmaKet: 0,
  yozuvlar: [],
  ismlar: [],
  suhbat: {},
  holat: { oxirgiKunlikEslatma: null, oxirgiOylikHisobot: null },
});

export class Daftar {
  constructor(yol) {
    this.yol = yol;
    this.baza = BOSH_BAZA();
    this.yuklash();
  }

  yuklash() {
    try {
      const xom = fs.readFileSync(this.yol, 'utf8');
      const oqilgan = JSON.parse(xom);
      this.baza = { ...BOSH_BAZA(), ...oqilgan };
      // eski fayllar to'liq bo'lmasligi mumkin — yetishmagan maydonlarni tiklaymiz
      this.baza.yozuvlar = Array.isArray(this.baza.yozuvlar) ? this.baza.yozuvlar : [];
      this.baza.ismlar = Array.isArray(this.baza.ismlar) ? this.baza.ismlar : [];
      this.baza.suhbat = this.baza.suhbat && typeof this.baza.suhbat === 'object' ? this.baza.suhbat : {};
      this.baza.holat = { ...BOSH_BAZA().holat, ...(this.baza.holat || {}) };
    } catch (xato) {
      if (xato.code !== 'ENOENT') {
        // buzilgan faylni o'chirmaymiz — chetga surib qo'yamiz
        const zaxira = `${this.yol}.buzilgan-${Date.now()}`;
        try {
          fs.renameSync(this.yol, zaxira);
          console.error(`[daftar] baza o‘qilmadi, chetga surildi: ${zaxira}`);
        } catch { /* fayl yo'q bo'lsa e'tiborsiz */ }
      }
      this.baza = BOSH_BAZA();
      this.saqlash();
    }
  }

  saqlash() {
    const papka = path.dirname(this.yol);
    fs.mkdirSync(papka, { recursive: true });
    const vaqtinchalik = `${this.yol}.tmp`;
    fs.writeFileSync(vaqtinchalik, JSON.stringify(this.baza, null, 2), 'utf8');
    try {
      if (fs.existsSync(this.yol)) fs.copyFileSync(this.yol, `${this.yol}.bak`);
    } catch { /* zaxira majburiy emas */ }
    fs.renameSync(vaqtinchalik, this.yol);
  }

  /* ---------------------------------------------------------------- */
  /* yozuvlar                                                          */
  /* ---------------------------------------------------------------- */

  get yozuvlar() {
    return this.baza.yozuvlar;
  }

  yangiId() {
    this.baza.ketmaKet += 1;
    return `Y${String(this.baza.ketmaKet).padStart(4, '0')}`;
  }

  qoshish(yozuv) {
    const toliq = {
      id: this.yangiId(),
      turi: 'pul_qarz',
      kim: '',
      nima: null,
      summa: null,
      valyuta: 'UZS',
      berilgan_sana: null,
      qaytarish_sanasi: null,
      izoh: null,
      holat: 'ochiq',
      qaytarilgan_sana: null,
      qaytarilgan_summa: 0,
      manba: 'matn',
      asl_matn: null,
      eslatilgan: [],
      // ovozdan yozilgan yozuv egasi tasdiqlagunicha (yoki muddat o'tguncha) kutadi
      tasdiq: 'tasdiqlangan',
      tasdiqMuddati: null,
      tasdiqChatId: null,
      tasdiqXabarId: null,
      yaratilgan: new Date().toISOString(),
      yangilangan: new Date().toISOString(),
      ...yozuv,
    };
    // sotuv — allaqachon yopilgan voqea
    if (toliq.turi === 'sotuv') {
      toliq.holat = 'qaytarildi';
      toliq.qaytarilgan_sana = toliq.qaytarilgan_sana || toliq.berilgan_sana;
      toliq.qaytarilgan_summa = toliq.summa ?? 0;
    }
    this.baza.yozuvlar.push(toliq);
    this.saqlash();
    return toliq;
  }

  topish(id) {
    const kalit = String(id || '').trim().toUpperCase();
    return this.baza.yozuvlar.find((y) => y.id.toUpperCase() === kalit) || null;
  }

  yangilash(id, ozgarishlar) {
    const yozuv = this.topish(id);
    if (!yozuv) return null;
    Object.assign(yozuv, ozgarishlar, { yangilangan: new Date().toISOString() });
    this.saqlash();
    return yozuv;
  }

  ochirish(id) {
    const indeks = this.baza.yozuvlar.findIndex((y) => y.id.toUpperCase() === String(id).toUpperCase());
    if (indeks === -1) return null;
    const [ochirilgan] = this.baza.yozuvlar.splice(indeks, 1);
    this.saqlash();
    return ochirilgan;
  }

  /* ---------------------------------------------------------------- */
  /* tasdiqlash (ovozdan yozilgan yozuvlar)                            */
  /* ---------------------------------------------------------------- */

  /** Hali tasdiqlanmagan yozuvlar */
  kutilayotganlar() {
    return this.baza.yozuvlar.filter((y) => y.tasdiq === 'kutilmoqda');
  }

  /** Muddati o'tgan, ya'ni jim qolinganligi uchun to'g'ri deb hisoblanadiganlar */
  muddatiOtganTasdiqlar(hozirgi = Date.now()) {
    return this.kutilayotganlar().filter(
      (y) => y.tasdiqMuddati && Date.parse(y.tasdiqMuddati) <= hozirgi,
    );
  }

  tasdiqlash(id) {
    const yozuv = this.topish(id);
    if (!yozuv || yozuv.tasdiq !== 'kutilmoqda') return null;
    return this.yangilash(id, { tasdiq: 'tasdiqlangan', tasdiqMuddati: null });
  }

  /** filtr: { kim, turi, holat, sana_dan, sana_gacha, matn } */
  qidirish(filtr = {}) {
    const past = (v) => String(v ?? '').toLowerCase().trim();
    const kim = past(filtr.kim);
    const matn = past(filtr.matn);

    return this.baza.yozuvlar.filter((y) => {
      if (kim && !past(y.kim).includes(kim)) return false;
      if (filtr.turi && y.turi !== filtr.turi) return false;
      if (filtr.holat === 'ochiq' && y.holat === 'qaytarildi') return false;
      if (filtr.holat && filtr.holat !== 'ochiq' && y.holat !== filtr.holat) return false;
      if (filtr.sana_dan && (y.berilgan_sana || '') < filtr.sana_dan) return false;
      if (filtr.sana_gacha && (y.berilgan_sana || '') > filtr.sana_gacha) return false;
      if (matn) {
        const hamma = [y.kim, y.nima, y.izoh, y.asl_matn].map(past).join(' ');
        if (!hamma.includes(matn)) return false;
      }
      return true;
    });
  }

  /* ---------------------------------------------------------------- */
  /* ismlar - ovozni to'g'ri eshitish uchun                            */
  /* ---------------------------------------------------------------- */

  /** Qo'lda qo'shilgan ismlar */
  get ismlar() {
    return this.baza.ismlar;
  }

  /** @returns {string[]} haqiqatan qo'shilganlari */
  ismQoshish(ismlar) {
    const bor = new Set(this.baza.ismlar.map((i) => i.toLowerCase()));
    const yangilar = [];
    for (const xom of ismlar) {
      const ism = String(xom).trim().replace(/\s+/g, ' ');
      if (!ism || ism.length > 60 || bor.has(ism.toLowerCase())) continue;
      bor.add(ism.toLowerCase());
      this.baza.ismlar.push(ism);
      yangilar.push(ism);
    }
    if (yangilar.length) this.saqlash();
    return yangilar;
  }

  ismOchirish(ism) {
    const oldin = this.baza.ismlar.length;
    this.baza.ismlar = this.baza.ismlar.filter((i) => i.toLowerCase() !== String(ism).trim().toLowerCase());
    if (this.baza.ismlar.length !== oldin) this.saqlash();
    return oldin !== this.baza.ismlar.length;
  }

  /* ---------------------------------------------------------------- */
  /* suhbat tarixi (agent konteksti uchun)                             */
  /* ---------------------------------------------------------------- */

  tarix(chatId) {
    return this.baza.suhbat[String(chatId)] || [];
  }

  tarixgaQoshish(chatId, rol, matn, chegara = 12) {
    const kalit = String(chatId);
    const royxat = this.baza.suhbat[kalit] || [];
    royxat.push({ role: rol, content: String(matn).slice(0, 4000) });
    // birinchi xabar doim 'user' bo'lishi shart — juft sonli qilib kesamiz
    this.baza.suhbat[kalit] = royxat.slice(-chegara * 2);
    if (this.baza.suhbat[kalit][0]?.role === 'assistant') this.baza.suhbat[kalit].shift();
    this.saqlash();
  }

  tarixniTozalash(chatId) {
    delete this.baza.suhbat[String(chatId)];
    this.saqlash();
  }

  /* ---------------------------------------------------------------- */

  holatniYozish(kalit, qiymat) {
    this.baza.holat[kalit] = qiymat;
    this.saqlash();
  }
}
