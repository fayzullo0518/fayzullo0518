/**
 * Sozlamalar — .env faylidan o'qiladi va bir marta tekshiriladi.
 * Noto'g'ri sozlama bilan bot umuman ishga tushmasin: xatoni darrov aytadi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';

const bu = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(bu, '..');

const ENV_YOLI = path.join(ROOT, '.env');
dotenv({ path: ENV_YOLI, quiet: true });

/** .env yo'q bo'lsa — nega yo'qligini aniqlashga harakat qilamiz */
function envYoqligiHaqida() {
  const qatorlar = ['.env fayli topilmadi.', '', `Qidirilgan joy:  ${ENV_YOLI}`];

  let fayllar = [];
  try {
    fayllar = fs.readdirSync(ROOT);
  } catch { /* papka o'qilmasa jim qolamiz */ }

  // Windows'da Notepad "Save as" qilganda .env.txt bo'lib ketadi — mashhur tuzoq
  const shubhali = fayllar.filter((f) => /^\.?env(\.|$)/i.test(f) && f !== '.env.example');
  if (shubhali.length) {
    qatorlar.push('', `Shunga o'xshash fayl bor:  ${shubhali.join(', ')}`);
    qatorlar.push("Nomi aynan  .env  bo'lishi kerak, .txt qo'shimchasisiz.");
    qatorlar.push('Windows:  Rename-Item .env.txt .env');
  } else {
    qatorlar.push('', 'Yaratish:');
    qatorlar.push('  Windows:  Copy-Item .env.example .env ; notepad .env');
    qatorlar.push('  Linux:    cp .env.example .env && nano .env');
  }

  if (!fayllar.includes('.env.example')) {
    qatorlar.push('', "Diqqat: .env.example ham yo'q - siz bot papkasida emasdirsiz.");
    qatorlar.push('Bot papkasi - ichida src/ va package.json bor papka.');
  }

  return qatorlar.join('\n');
}

const matn = (kalit, sukut = '') => String(process.env[kalit] ?? sukut).trim();

const son = (kalit, sukut) => {
  const xom = matn(kalit);
  if (!xom) return sukut;
  const n = Number(xom);
  return Number.isFinite(n) ? n : sukut;
};

/** Claude'da effort parametrini qo'llab-quvvatlaydigan modellar */
const effortBor = (model) => /^claude-(opus-(5|4-6|4-7|4-8)|sonnet-5|fable-5)/.test(model);

const SUKUT_MODEL = { deepseek: 'deepseek-chat', claude: 'claude-opus-5' };

/**
 * Whisper uchun uslub namunasi. Model shu matnga qarab imlo va so'z
 * tanlaydi, shuning uchun bu yerda o'zbek lotini va daftarning odatiy
 * so'zlari turadi - turkchaga og'ib ketmasligi uchun.
 */
const ASR_YORIQNOMA = "O'zbek tilidagi yozuv. Misollar: Sardorga UZI apparati berdim, "
  + "o'n ikki million so'm, birinchi oktabrgacha to'laydi. Akmalga besh million qarz "
  + "berdim, oyning oxirida qaytaradi. Jasurga kardiograf vaqtincha berdim, yigirma "
  + "kundan keyin qaytaradi. Nodir qarzini qaytardi.";

/**
 * @param {{telegramShart?: boolean}} sozlash
 *   telegramShart=false - terminal rejimi uchun: Telegram tokeni kerak emas.
 */
export function sozlamalar(sozlash = {}) {
  const { telegramShart = true } = sozlash;
  if (!fs.existsSync(ENV_YOLI)) throw new Error(envYoqligiHaqida());

  const xatolar = [];

  const token = matn('TELEGRAM_BOT_TOKEN');
  if (!token && telegramShart) xatolar.push('TELEGRAM_BOT_TOKEN kiritilmagan (@BotFather dan oling)');

  // ── qaysi til modeli ishlatiladi ────────────────────────────────────
  const deepseekKalit = matn('DEEPSEEK_API_KEY');
  const anthropicKalit = matn('ANTHROPIC_API_KEY');

  let xizmat = matn('LLM_XIZMATI').toLowerCase();
  if (!xizmat) xizmat = deepseekKalit ? 'deepseek' : anthropicKalit ? 'claude' : '';

  if (!xizmat) {
    xatolar.push('DEEPSEEK_API_KEY yoki ANTHROPIC_API_KEY dan bittasi kerak');
  } else if (!['deepseek', 'claude'].includes(xizmat)) {
    xatolar.push(`LLM_XIZMATI faqat "deepseek" yoki "claude" bo‘lishi mumkin (hozir: ${xizmat})`);
  } else if (xizmat === 'deepseek' && !deepseekKalit) {
    xatolar.push('LLM_XIZMATI=deepseek, lekin DEEPSEEK_API_KEY yo‘q');
  } else if (xizmat === 'claude' && !anthropicKalit) {
    xatolar.push('LLM_XIZMATI=claude, lekin ANTHROPIC_API_KEY yo‘q');
  }

  // ── vaqt va eslatma ─────────────────────────────────────────────────
  const eslatmaSoati = son('ESLATMA_SOATI', 9);
  if (!Number.isInteger(eslatmaSoati) || eslatmaSoati < 0 || eslatmaSoati > 23) {
    xatolar.push('ESLATMA_SOATI 0 va 23 orasidagi butun son bo‘lishi kerak');
  }

  const tekshiruvSoniya = son('TEKSHIRUV_SONIYA', 60);
  if (!(tekshiruvSoniya >= 1) || tekshiruvSoniya > 3600) {
    xatolar.push('TEKSHIRUV_SONIYA 1 va 3600 orasida bo\'lishi kerak');
  }

  const tasdiqDaqiqa = son('TASDIQ_DAQIQA', 10);
  if (!(tasdiqDaqiqa > 0) || tasdiqDaqiqa > 1440) {
    xatolar.push('TASDIQ_DAQIQA 1 va 1440 orasida bo‘lishi kerak');
  }

  const vaqtMintaqasi = matn('TIMEZONE', 'Asia/Tashkent');
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: vaqtMintaqasi });
  } catch {
    xatolar.push(`TIMEZONE noto‘g‘ri: ${vaqtMintaqasi}`);
  }

  if (xatolar.length) {
    const xabar = xatolar.map((x) => `  • ${x}`).join('\n');
    throw new Error(
      `.env fayli to‘liq emas:\n${xabar}\n\nFayl: ${ENV_YOLI}\n`
      + 'Uni oching va yetishmayotgan qatorlarni to‘ldiring.',
    );
  }

  const model = matn('LLM_MODEL') || SUKUT_MODEL[xizmat];
  const effort = matn('CLAUDE_EFFORT', 'medium').toLowerCase();

  const openai = matn('OPENAI_API_KEY');
  const groq = matn('GROQ_API_KEY');
  const deepgram = matn('DEEPGRAM_API_KEY');

  // Groq OpenAI bilan bir xil API beradi, shuning uchun bir xil kod yo'li
  const asrXizmati = openai ? 'openai' : groq ? 'groq' : deepgram ? 'deepgram' : 'yoq';
  const ASR_SUKUT = {
    openai: { asos: 'https://api.openai.com', model: 'whisper-1', kalit: openai },
    groq: { asos: 'https://api.groq.com/openai', model: 'whisper-large-v3', kalit: groq },
    deepgram: { asos: 'https://api.deepgram.com', model: 'nova-2', kalit: deepgram },
    yoq: { asos: '', model: '', kalit: '' },
  }[asrXizmati];

  return {
    token,
    // sinov/demo uchun boshqa manzilga yo'naltirish mumkin
    telegramAsos: matn('TELEGRAM_ASOS', 'https://api.telegram.org'),
    egaId: son('OWNER_ID', 0),

    xizmat,
    model,
    deepseekKalit,
    deepseekAsos: matn('DEEPSEEK_ASOS', 'https://api.deepseek.com'),
    anthropicKalit,
    // model qo'llab-quvvatlamasa umuman yubormaymiz — aks holda 400 qaytadi
    effort: xizmat === 'claude' && effortBor(model) && ['low', 'medium', 'high'].includes(effort)
      ? effort
      : null,

    vaqtMintaqasi,
    eslatmaSoati,
    tasdiqDaqiqa,
    tekshiruvSoniya,
    valyuta: matn('VALYUTA', 'UZS').toUpperCase() || 'UZS',

    asr: asrXizmati,
    asrKalit: ASR_SUKUT.kalit,
    asrModel: matn('ASR_MODEL') || ASR_SUKUT.model,
    asrAsos: (matn('ASR_ASOS') || ASR_SUKUT.asos).replace(/\/+$/, ''),
    asrTil: matn('ASR_TIL', 'uz'),
    asrYoriqnoma: matn('ASR_YORIQNOMA', ASR_YORIQNOMA),
    asrUzbeklashtir: matn('ASR_UZBEKLASHTIR', '1') !== '0',
    asrIsmlar: matn('ASR_ISMLAR'),
    asrTozalash: matn('ASR_TOZALASH', '1') !== '0',

    bazaYoli: matn('BAZA_YOLI') || path.join(ROOT, 'data', 'daftar.json'),
  };
}
