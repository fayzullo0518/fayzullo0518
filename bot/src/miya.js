/**
 * "Miya" qatlami — qaysi til modeli ishlatilishidan agentni ajratadi.
 *
 * Ikki xizmat qo'llab-quvvatlanadi:
 *   deepseek — api.deepseek.com, OpenAI uslubidagi chat/completions
 *   claude   — Anthropic SDK
 *
 * Ikkalasi ham bir xil ko'rinishda javob qaytaradi:
 *   { matn, chaqiruvlar: [{id, nom, kirish}], tugash: 'end'|'tool'|'max'|'refusal', xom }
 * Suhbat tarixini ham har biri o'zi to'playdi, chunki xabar formatlari boshqacha.
 */
import Anthropic from '@anthropic-ai/sdk';

export class MiyaXatosi extends Error {
  constructor(xabar, { qayta = false } = {}) {
    super(xabar);
    this.qaytaUrinsaBoladi = qayta;
  }
}

/* ================================================================== */
/* DeepSeek                                                            */
/* ================================================================== */

/** Anthropic sxemasini OpenAI "function" shakliga o'giradi */
const openaiVositalari = (vositalar) =>
  vositalar.map((v) => ({
    type: 'function',
    function: { name: v.name, description: v.description, parameters: v.input_schema },
  }));

class DeepseekMiya {
  constructor(cfg) {
    this.nomi = 'deepseek';
    this.model = cfg.model;
    this.kalit = cfg.deepseekKalit;
    this.asos = (cfg.deepseekAsos || 'https://api.deepseek.com').replace(/\/+$/, '');
    this.harorat = 0; // hisob-kitob ishi — ijod kerak emas, barqarorlik kerak
  }

  tayyorlash({ yoriqnoma, tarix, xabar }) {
    return [
      { role: 'system', content: yoriqnoma },
      ...tarix.map((x) => ({ role: x.role, content: x.content })),
      { role: 'user', content: xabar },
    ];
  }

  async sorov({ messages, vositalar }) {
    let javob;
    try {
      javob = await fetch(`${this.asos}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.kalit}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          // vositasiz chaqiruv ham bo'ladi (matn tozalash) - bo'sh ro'yxat yubormaymiz
          ...(vositalar.length
            ? { tools: openaiVositalari(vositalar), tool_choice: 'auto' }
            : {}),
          temperature: this.harorat,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(180000),
      });
    } catch (e) {
      throw new MiyaXatosi(
        `DeepSeek ga ulanib bo'lmadi (${e.name}: ${e.message}). Internetni tekshiring.`,
        { qayta: true },
      );
    }

    const xom = await javob.text();
    if (!javob.ok) throw deepseekXatosi(javob.status, xom);

    let natija;
    try {
      natija = JSON.parse(xom);
    } catch {
      throw new MiyaXatosi(`DeepSeek javobi JSON emas: ${xom.slice(0, 150)}`, { qayta: true });
    }

    const xabar = natija?.choices?.[0]?.message;
    if (!xabar) throw new MiyaXatosi(`DeepSeek javobi kutilgandek emas: ${xom.slice(0, 150)}`);

    const sabab = natija.choices[0].finish_reason;
    const chaqiruvlar = (xabar.tool_calls || []).map((ch) => ({
      id: ch.id,
      nom: ch.function?.name || '',
      kirish: jsonOqish(ch.function?.arguments),
    }));

    return {
      matn: String(xabar.content || '').trim(),
      chaqiruvlar,
      tugash: chaqiruvlar.length ? 'tool' : sabab === 'length' ? 'max' : sabab === 'content_filter' ? 'refusal' : 'end',
      xom: xabar,
    };
  }

  javobniQoshish(messages, xom) {
    // content null bo'lishi mumkin — API buni qabul qilmasligi mumkin, bo'sh satrga aylantiramiz
    messages.push({ ...xom, content: xom.content ?? '' });
  }

  natijalarniQoshish(messages, natijalar) {
    for (const n of natijalar) {
      messages.push({ role: 'tool', tool_call_id: n.id, content: n.matn });
    }
  }
}

/** Argumentlar JSON satri bo'lib keladi; buzuq bo'lsa vosita xato qaytaradi */
function jsonOqish(satr) {
  if (!satr) return {};
  if (typeof satr === 'object') return satr;
  try {
    const qiymat = JSON.parse(satr);
    return qiymat && typeof qiymat === 'object' ? qiymat : {};
  } catch {
    return { __buzuqJson: String(satr).slice(0, 300) };
  }
}

function deepseekXatosi(holat, tana) {
  const qisqa = String(tana).slice(0, 200);
  if (holat === 401) return new MiyaXatosi('DEEPSEEK_API_KEY noto‘g‘ri yoki bekor qilingan.');
  if (holat === 402) return new MiyaXatosi('DeepSeek balansi tugagan. Hisobni to‘ldiring.');
  if (holat === 429) return new MiyaXatosi('DeepSeek so‘rovlar chegarasi. Biroz kutib qayta yuboring.', { qayta: true });
  if (holat >= 500) return new MiyaXatosi(`DeepSeek serverida nosozlik (${holat}).`, { qayta: true });
  return new MiyaXatosi(`DeepSeek xatosi (${holat}): ${qisqa}`);
}

/* ================================================================== */
/* Claude                                                              */
/* ================================================================== */

class ClaudeMiya {
  constructor(cfg) {
    this.nomi = 'claude';
    this.model = cfg.model;
    this.effort = cfg.effort;
    this.client = new Anthropic({ apiKey: cfg.anthropicKalit, maxRetries: 3 });
  }

  tayyorlash({ yoriqnoma, tarix, xabar }) {
    this.yoriqnoma = yoriqnoma;
    return [...tarix.map((x) => ({ role: x.role, content: x.content })), { role: 'user', content: xabar }];
  }

  async sorov({ messages, vositalar }) {
    const sorov = {
      model: this.model,
      max_tokens: 8000,
      system: [{ type: 'text', text: this.yoriqnoma, cache_control: { type: 'ephemeral' } }],
      messages,
      ...(vositalar.length ? { tools: vositalar } : {}),
    };
    if (this.effort) sorov.output_config = { effort: this.effort };

    let natija;
    try {
      natija = await this.client.messages.create(sorov);
    } catch (e) {
      throw claudeXatosi(e);
    }

    const matn = natija.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join('\n\n');

    const chaqiruvlar = natija.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id, nom: b.name, kirish: b.input && typeof b.input === 'object' ? b.input : {} }));

    const tugash = natija.stop_reason === 'tool_use' ? 'tool'
      : natija.stop_reason === 'refusal' ? 'refusal'
        : natija.stop_reason === 'max_tokens' ? 'max' : 'end';

    return { matn, chaqiruvlar, tugash, xom: natija.content };
  }

  javobniQoshish(messages, xom) {
    messages.push({ role: 'assistant', content: xom });
  }

  natijalarniQoshish(messages, natijalar) {
    messages.push({
      role: 'user',
      content: natijalar.map((n) => ({
        type: 'tool_result',
        tool_use_id: n.id,
        content: n.matn,
        ...(n.xato ? { is_error: true } : {}),
      })),
    });
  }
}

function claudeXatosi(e) {
  if (e instanceof Anthropic.AuthenticationError) return new MiyaXatosi('ANTHROPIC_API_KEY noto‘g‘ri yoki eskirgan.');
  if (e instanceof Anthropic.RateLimitError) return new MiyaXatosi('So‘rovlar chegarasiga yetdik. Biroz kutib qayta yuboring.', { qayta: true });
  if (e instanceof Anthropic.APIConnectionError) return new MiyaXatosi('Anthropic xizmatiga ulanib bo‘lmadi.', { qayta: true });
  if (e instanceof Anthropic.APIError) return new MiyaXatosi(`Anthropic xatosi (${e.status}): ${e.message}`, { qayta: e.status >= 500 });
  return new MiyaXatosi(`Xatolik: ${e.message}`);
}

/* ================================================================== */

export function miyaYaratish(cfg) {
  return cfg.xizmat === 'deepseek' ? new DeepseekMiya(cfg) : new ClaudeMiya(cfg);
}
