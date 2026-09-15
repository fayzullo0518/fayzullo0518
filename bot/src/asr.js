/**
 * Ovozli xabarni matnga o'girish.
 *
 * Claude ham, DeepSeek ham audio qabul qilmaydi, shuning uchun bu bosqich
 * alohida xizmat orqali bajariladi. Uchta variant qo'llab-quvvatlanadi —
 * qaysi kalit .env da bo'lsa, o'sha ishlatiladi:
 *
 *   OPENAI_API_KEY    Whisper.        Pullik, ~0.006 $/daqiqa.
 *   GROQ_API_KEY      whisper-large-v3. Bepul boshlang'ich limiti bor.
 *   DEEPGRAM_API_KEY  nova-2.         Bepul boshlang'ich krediti bor.
 *
 * Telegram ovozli xabari .oga (Opus) bo'ladi va hammasi uni to'g'ridan-to'g'ri
 * qabul qiladi — ffmpeg kerak emas.
 */

const CHEGARA_BAYT = 24 * 1024 * 1024; // xizmatlar ~25MB qabul qiladi

/** kengaytma -> MIME turi */
const TURLAR = {
  ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg', mpga: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4',
  webm: 'audio/webm', flac: 'audio/flac',
};

/**
 * Telegram ovozli xabarni ".oga" deb ataydi. Tarkibi oddiy Ogg/Opus, lekin
 * Groq ro'yxatida "oga" yo'q - "ogg" bor. Shuning uchun nomni moslaymiz;
 * baytlarga tegilmaydi.
 */
const KENGAYTMA_MOSLIGI = { oga: 'ogg', ogv: 'ogg', oga_: 'ogg' };

/** Xizmatlar tanishi uchun fayl nomini va turini tayyorlaydi */
export function faylniTayyorlash(nom) {
  const toza = String(nom || 'audio').split(/[\\/]/).pop();
  const nuqta = toza.lastIndexOf('.');
  const asos = (nuqta > 0 ? toza.slice(0, nuqta) : toza) || 'audio';
  const xom = (nuqta > 0 ? toza.slice(nuqta + 1) : '').toLowerCase();
  const kengaytma = KENGAYTMA_MOSLIGI[xom] || (TURLAR[xom] ? xom : 'ogg');
  return { nom: `${asos}.${kengaytma}`, tur: TURLAR[kengaytma] || 'audio/ogg' };
}

export class OvozXatosi extends Error {}

const KALIT_NOMI = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
};

export async function ovozdanMatn(buffer, nom, cfg) {
  if (cfg.asr === 'yoq') {
    throw new OvozXatosi(
      'Ovozli xabarni matnga o‘girish uchun kalit sozlanmagan.\n'
      + 'Bepul variant: console.groq.com dan kalit olib, .env ga GROQ_API_KEY qo‘ying.\n'
      + 'Hozircha yozib yuboring — yozma xabar to‘liq ishlaydi.',
    );
  }
  if (buffer.length > CHEGARA_BAYT) {
    throw new OvozXatosi('Ovozli xabar juda katta (25MB dan ortiq). Qisqaroq yuboring.');
  }

  const matn = cfg.asr === 'deepgram'
    ? await deepgramOrqali(buffer, nom, cfg)
    : await whisperOrqali(buffer, nom, cfg);   // openai va groq bir xil API

  const tozalangan = String(matn || '').trim();
  if (!tozalangan) {
    throw new OvozXatosi('Ovozdan matn chiqmadi — qaytadan, sekinroq aytib ko‘ring.');
  }
  return tozalangan;
}

/** OpenAI va Groq bir xil "audio/transcriptions" API beradi */
async function whisperOrqali(buffer, nom, cfg) {
  const fayl = faylniTayyorlash(nom);
  const forma = new FormData();
  forma.append('file', new Blob([buffer], { type: fayl.tur }), fayl.nom);
  forma.append('model', cfg.asrModel);
  forma.append('language', 'uz');
  forma.append('response_format', 'json');

  const javob = await fetch(`${cfg.asrAsos}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.asrKalit}` },
    body: forma,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) {
    throw ovozXatosiTuzish(cfg.asr, javob.status, await javob.text().catch(() => ''), fayl);
  }
  return (await javob.json()).text;
}

// Deepgram formatni Content-Type sarlavhasidan biladi
async function deepgramOrqali(buffer, nom, cfg) {
  const { tur } = faylniTayyorlash(nom);
  const manzil = `${cfg.asrAsos}/v1/listen`
    + `?model=${encodeURIComponent(cfg.asrModel)}&language=uz&smart_format=true&punctuate=true`;

  const javob = await fetch(manzil, {
    method: 'POST',
    headers: { authorization: `Token ${cfg.asrKalit}`, 'content-type': tur },
    body: buffer,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) {
    throw ovozXatosiTuzish(cfg.asr, javob.status, await javob.text().catch(() => ''), { nom, tur });
  }
  const natija = await javob.json();
  return natija?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
}

/**
 * Xizmatlarning xatolarini tushunarli qilib beradi.
 * 429 ikki xil bo'ladi: balans tugagani va haqiqiy chegara — ularni
 * ajratmasak, odam bekorga kutib o'tiradi.
 */
function ovozXatosiTuzish(xizmat, holat, tana, yuborilgan = {}) {
  const past = String(tana).toLowerCase();
  const balansTugagan = /no credits|insufficient|quota|billing|exceeded your current/.test(past);
  const kalit = KALIT_NOMI[xizmat] || 'kalit';

  if (holat === 401 || holat === 403) {
    return new OvozXatosi(`${kalit} noto‘g‘ri yoki bekor qilingan.`);
  }

  if (balansTugagan || holat === 402) {
    const qayerda = {
      openai: 'platform.openai.com/settings/organization/billing',
      groq: 'console.groq.com/settings/billing',
      deepgram: 'console.deepgram.com',
    }[xizmat] || '';

    return new OvozXatosi(
      `Ovoz xizmatining (${xizmat}) balansi tugagan.\n\n`
      + `To‘ldirish: ${qayerda}\n\n`
      + (xizmat === 'openai'
        ? 'Yoki bepul muqobil: console.groq.com dan kalit olib,\n'
          + '.env dagi OPENAI_API_KEY ni bo‘sh qoldirib, GROQ_API_KEY ga yozing.\n\n'
        : '')
      + 'Hozircha yozma xabar yuboring — u to‘liq ishlaydi.',
    );
  }

  if (holat === 429) {
    return new OvozXatosi(
      `${xizmat} so‘rovlar chegarasiga yetdi. Bir daqiqadan keyin qayta yuboring.`,
    );
  }

  if (/must be one of the following types|unsupported.*format|invalid file format/i.test(past)) {
    return new OvozXatosi(
      `Ovoz xizmati (${xizmat}) fayl turini qabul qilmadi.\n\n`
      + `Yuborilgan nom:  ${yuborilgan.nom || '(noma\u2019lum)'}\n`
      + `Yuborilgan turi: ${yuborilgan.tur || '(noma\u2019lum)'}\n\n`
      + 'Agar nom ".oga" bilan tugagan bo\u2018lsa, demak eski kod ishlab turibdi:\n'
      + '  git pull  va botni qayta ishga tushiring (Ctrl+C, npm start).\n'
      + '  Versiyani tekshirish:  npm run tekshir',
    );
  }

  if (holat === 413) {
    return new OvozXatosi('Ovozli xabar xizmat uchun juda katta. Qisqaroq yuboring.');
  }

  return new OvozXatosi(`Ovoz xizmati (${xizmat}) xato qaytardi (${holat}): ${String(tana).slice(0, 150)}`);
}
