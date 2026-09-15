/**
 * Ismlar ro'yxati — ovozni to'g'ri eshitish uchun eng muhim narsa.
 *
 * Whisper "prompt" parametrini uslub namunasi sifatida ishlatadi: unda
 * uchragan atoqli otlarni aynan o'shandek yozishga moyil bo'ladi. Shuning
 * uchun daftardagi ismlarni oldindan berib qo'ysak, "Sardor" ni "Serdar"
 * yoki "Sardarov" deb yozib yuborish ancha kamayadi.
 *
 * Ro'yxat uch manbadan yig'iladi: daftardagi yozuvlar, qo'lda qo'shilganlar
 * (/ismlar buyrug'i) va .env dagi ASR_ISMLAR.
 */

// Whisper prompt ~224 token bilan cheklangan; ehtiyot uchun belgilarda o'lchaymiz
const PROMPT_CHEGARASI = 700;
const MAX_ISM = 40;

/** Barcha manbalardan ismlarni yig'adi, takrorlarni olib tashlaydi */
export function ismlarniYigish(daftar, cfg = {}) {
  const korilgan = new Set();
  const natija = [];

  const qosh = (xom) => {
    const ism = String(xom ?? '').trim().replace(/\s+/g, ' ');
    if (!ism || ism.length > 60) return;
    const kalit = ism.toLowerCase();
    if (korilgan.has(kalit)) return;
    korilgan.add(kalit);
    natija.push(ism);
  };

  // qo'lda qo'shilganlar birinchi - ular eng ishonchli
  for (const ism of daftar?.ismlar || []) qosh(ism);
  for (const ism of String(cfg.asrIsmlar || '').split(/[,;\n]/)) qosh(ism);

  // daftardagilar: yangi yozuvlar oldinroq turadi
  const yozuvlar = [...(daftar?.yozuvlar || [])].reverse();
  for (const y of yozuvlar) qosh(y.kim);

  return natija;
}

/**
 * Whisper uchun yo'riqnoma matni: ismlar + o'zbek lotinidagi namuna.
 * Ismlar oldinda turadi, chunki eng qimmatli qism shu.
 */
export function whisperYoriqnomasi(ismlar, cfg = {}) {
  const asos = cfg.asrYoriqnoma || '';
  if (!ismlar.length) return asos;

  const qism = [];
  let uzunlik = asos.length + 10;

  for (const ism of ismlar.slice(0, MAX_ISM)) {
    if (uzunlik + ism.length + 2 > PROMPT_CHEGARASI) break;
    qism.push(ism);
    uzunlik += ism.length + 2;
  }

  if (!qism.length) return asos;
  return `Ismlar: ${qism.join(', ')}. ${asos}`.slice(0, PROMPT_CHEGARASI);
}
