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

/** effort parametrini qo'llab-quvvatlaydigan modellar */
const effortBor = (model) =>
  /^claude-(opus-(5|4-6|4-7|4-8)|sonnet-5|fable-5)/.test(model);

export function sozlamalar() {
  const token = matn('TELEGRAM_BOT_TOKEN');
  const anthropicKalit = matn('ANTHROPIC_API_KEY');

  const xatolar = [];
  if (!token) xatolar.push('TELEGRAM_BOT_TOKEN kiritilmagan (@BotFather dan oling)');
  if (!anthropicKalit) xatolar.push('ANTHROPIC_API_KEY kiritilmagan (console.anthropic.com)');

  const eslatmaSoati = son('ESLATMA_SOATI', 9);
  if (!Number.isInteger(eslatmaSoati) || eslatmaSoati < 0 || eslatmaSoati > 23) {
    xatolar.push('ESLATMA_SOATI 0 va 23 orasidagi butun son bo‘lishi kerak');
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

  const model = matn('CLAUDE_MODEL', 'claude-opus-5');
  const effort = matn('CLAUDE_EFFORT', 'medium').toLowerCase();

  const openai = matn('OPENAI_API_KEY');
  const deepgram = matn('DEEPGRAM_API_KEY');

  return {
    token,
    anthropicKalit,
    egaId: son('OWNER_ID', 0),
    model,
    // model qo'llab-quvvatlamasa umuman yubormaymiz — aks holda 400 qaytadi
    effort: effortBor(model) && ['low', 'medium', 'high'].includes(effort) ? effort : null,
    vaqtMintaqasi,
    eslatmaSoati,
    valyuta: matn('VALYUTA', 'UZS').toUpperCase() || 'UZS',
    asr: openai ? 'openai' : deepgram ? 'deepgram' : 'yoq',
    openaiKalit: openai,
    deepgramKalit: deepgram,
    bazaYoli: path.join(ROOT, 'data', 'daftar.json'),
  };
}
