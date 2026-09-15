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
  const forma = new FormData();
  forma.append('file', new Blob([buffer]), nom || 'audio.oga');
  forma.append('model', cfg.asrModel);
  forma.append('language', 'uz');
  forma.append('response_format', 'json');

  const javob = await fetch(`${cfg.asrAsos}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.asrKalit}` },
    body: forma,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) throw ovozXatosiTuzish(cfg.asr, javob.status, await javob.text().catch(() => ''));
  return (await javob.json()).text;
}

/** Deepgram formatni sarlavhadan biladi, shuning uchun to'g'ri turini beramiz */
const TURLAR = {
  oga: 'audio/ogg', ogg: 'audio/ogg', opus: 'audio/ogg',
  wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', webm: 'audio/webm',
};

async function deepgramOrqali(buffer, nom, cfg) {
  const kengaytma = String(nom || '').split('.').pop().toLowerCase();
  const tur = TURLAR[kengaytma] || 'audio/ogg';
  const manzil = `${cfg.asrAsos}/v1/listen`
    + `?model=${encodeURIComponent(cfg.asrModel)}&language=uz&smart_format=true&punctuate=true`;

  const javob = await fetch(manzil, {
    method: 'POST',
    headers: { authorization: `Token ${cfg.asrKalit}`, 'content-type': tur },
    body: buffer,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) throw ovozXatosiTuzish(cfg.asr, javob.status, await javob.text().catch(() => ''));
  const natija = await javob.json();
  return natija?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
}

/**
 * Xizmatlarning xatolarini tushunarli qilib beradi.
 * 429 ikki xil bo'ladi: balans tugagani va haqiqiy chegara — ularni
 * ajratmasak, odam bekorga kutib o'tiradi.
 */
function ovozXatosiTuzish(xizmat, holat, tana) {
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

  if (holat === 413) {
    return new OvozXatosi('Ovozli xabar xizmat uchun juda katta. Qisqaroq yuboring.');
  }

  return new OvozXatosi(`Ovoz xizmati (${xizmat}) xato qaytardi (${holat}): ${String(tana).slice(0, 150)}`);
}
