/**
 * Ovozli xabarni matnga o'girish.
 *
 * Claude audio qabul qilmaydi, shuning uchun bu bosqich alohida xizmat orqali
 * bajariladi. Ikki variant qo'llab-quvvatlanadi — qaysi kalit .env da bo'lsa,
 * o'sha ishlatiladi. Telegram ovozli xabari .oga (Opus) bo'ladi va ikkala
 * xizmat ham uni to'g'ridan-to'g'ri qabul qiladi, ffmpeg kerak emas.
 */

const CHEGARA_BAYT = 24 * 1024 * 1024; // xizmatlar ~25MB qabul qiladi

export class OvozXatosi extends Error {}

export async function ovozdanMatn(buffer, nom, cfg) {
  if (cfg.asr === 'yoq') {
    throw new OvozXatosi(
      'Ovozli xabarni matnga o‘girish uchun kalit sozlanmagan. ' +
        '.env faylga OPENAI_API_KEY yoki DEEPGRAM_API_KEY qo‘shing. ' +
        'Hozircha yozib yuboring — yozma xabar to‘liq ishlaydi.',
    );
  }
  if (buffer.length > CHEGARA_BAYT) {
    throw new OvozXatosi('Ovozli xabar juda katta (25MB dan ortiq). Qisqaroq yuboring.');
  }

  const matn = cfg.asr === 'openai'
    ? await openaiOrqali(buffer, nom, cfg.openaiKalit, cfg.asrAsos)
    : await deepgramOrqali(buffer, cfg.deepgramKalit, cfg.asrAsos);

  const tozalangan = String(matn || '').trim();
  if (!tozalangan) throw new OvozXatosi('Ovozdan matn chiqmadi — qaytadan, sekinroq aytib ko‘ring.');
  return tozalangan;
}

async function openaiOrqali(buffer, nom, kalit, asos) {
  const forma = new FormData();
  forma.append('file', new Blob([buffer]), nom || 'audio.oga');
  forma.append('model', 'whisper-1');
  forma.append('language', 'uz');
  forma.append('response_format', 'json');

  const manzil = `${(asos || 'https://api.openai.com').replace(/\/+$/, '')}/v1/audio/transcriptions`;
  const javob = await fetch(manzil, {
    method: 'POST',
    headers: { authorization: `Bearer ${kalit}` },
    body: forma,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) {
    const xato = await javob.text().catch(() => '');
    throw new OvozXatosi(`Ovozni o‘girish xizmati xato qaytardi (${javob.status}): ${xato.slice(0, 200)}`);
  }
  const natija = await javob.json();
  return natija.text;
}

async function deepgramOrqali(buffer, kalit, asos) {
  const manzil = `${(asos || 'https://api.deepgram.com').replace(/\/+$/, '')}`
    + '/v1/listen?model=nova-2&language=uz&smart_format=true&punctuate=true';
  const javob = await fetch(manzil, {
    method: 'POST',
    headers: { authorization: `Token ${kalit}`, 'content-type': 'audio/ogg' },
    body: buffer,
    signal: AbortSignal.timeout(180000),
  });

  if (!javob.ok) {
    const xato = await javob.text().catch(() => '');
    throw new OvozXatosi(`Ovozni o‘girish xizmati xato qaytardi (${javob.status}): ${xato.slice(0, 200)}`);
  }
  const natija = await javob.json();
  return natija?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
}
