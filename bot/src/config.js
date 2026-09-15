/**
 * Sozlamalar — .env faylidan o'qiladi va bir marta tekshiriladi.
 * Noto'g'ri sozlama bilan bot umuman ishga tushmasin: xatoni darrov aytadi.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';

const bu = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(bu, '..');

dotenv({ path: path.join(ROOT, '.env'), quiet: true });

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

export function sozlamalar() {
  const xatolar = [];

  const token = matn('TELEGRAM_BOT_TOKEN');
  if (!token) xatolar.push('TELEGRAM_BOT_TOKEN kiritilmagan (@BotFather dan oling)');

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
    throw new Error(`.env fayli to‘liq emas:\n${xabar}\n\n.env.example dan nusxa oling.`);
  }

  const model = matn('LLM_MODEL') || SUKUT_MODEL[xizmat];
  const effort = matn('CLAUDE_EFFORT', 'medium').toLowerCase();

  const openai = matn('OPENAI_API_KEY');
  const deepgram = matn('DEEPGRAM_API_KEY');

  return {
    token,
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
    valyuta: matn('VALYUTA', 'UZS').toUpperCase() || 'UZS',

    asr: openai ? 'openai' : deepgram ? 'deepgram' : 'yoq',
    openaiKalit: openai,
    deepgramKalit: deepgram,

    bazaYoli: path.join(ROOT, 'data', 'daftar.json'),
  };
}
