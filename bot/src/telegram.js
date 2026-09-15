/**
 * Telegram Bot API bilan ishlash — kutubxonasiz, Node'ning o'z fetch'i orqali.
 *
 * Xabarlar HTML rejimida yuboriladi; matn har doim `esc()` dan o'tkaziladi,
 * shuning uchun "parse error" hech qachon chiqmaydi.
 */

const CHEGARA = 3900; // Telegram chegarasi 4096, ehtiyot uchun pastroq

export const esc = (matn) =>
  String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export class Telegram {
  constructor(token, asos = 'https://api.telegram.org') {
    const ildiz = String(asos).replace(/\/+$/, '');
    this.token = token;
    this.asos = `${ildiz}/bot${token}`;
    this.faylAsos = `${ildiz}/file/bot${token}`;
  }

  async chaqir(metod, tana, { kutish = 30000 } = {}) {
    let javob;
    try {
      javob = await fetch(`${this.asos}/${metod}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(tana ?? {}),
        signal: AbortSignal.timeout(kutish),
      });
    } catch (e) {
      // tarmoq uzilishi, DNS, proksi, timeout — hammasi shu yerga tushadi
      throw new Error(`Telegram ${metod}: tarmoqqa ulanib bo'lmadi (${e.name}: ${e.message})`);
    }

    return tekshir(metod, javob, await javob.text());
  }

  getUpdates(offset, timeout = 50) {
    return this.chaqir(
      'getUpdates',
      { offset, timeout, allowed_updates: ['message', 'callback_query'] },
      { kutish: (timeout + 15) * 1000 },
    );
  }

  /** Uzun matnni bo'lib yuboradi. Matn HTML bo'lib kelishi kutiladi. */
  async sendMessage(chatId, html, qoshimcha = {}) {
    const bolaklar = bolish(String(html));
    let oxirgi = null;
    for (let i = 0; i < bolaklar.length; i += 1) {
      const songgi = i === bolaklar.length - 1;
      oxirgi = await this.chaqir('sendMessage', {
        chat_id: chatId,
        text: bolaklar[i],
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(songgi ? qoshimcha : {}),
      });
    }
    return oxirgi;
  }

  sendChatAction(chatId, action = 'typing') {
    return this.chaqir('sendChatAction', { chat_id: chatId, action }).catch(() => null);
  }

  answerCallbackQuery(id, text) {
    return this.chaqir('answerCallbackQuery', { callback_query_id: id, text }).catch(() => null);
  }

  editMessageReplyMarkup(chatId, messageId, markup = { inline_keyboard: [] }) {
    return this.chaqir('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: markup,
    }).catch(() => null);
  }

  /** Botga webhook o'rnatilganmi? Long polling u bilan birga ishlamaydi. */
  webhookMalumoti() {
    return this.chaqir('getWebhookInfo');
  }

  /** Webhook'ni olib tashlaydi — shundan keyin long polling ishlaydi */
  webhookniOchirish() {
    return this.chaqir('deleteWebhook', { drop_pending_updates: false });
  }

  setMyCommands(buyruqlar) {
    return this.chaqir('setMyCommands', { commands: buyruqlar }).catch(() => null);
  }

  /** file_id -> Buffer */
  async faylniYuklash(fileId) {
    const fayl = await this.chaqir('getFile', { file_id: fileId });
    const javob = await fetch(`${this.faylAsos}/${fayl.file_path}`, {
      signal: AbortSignal.timeout(120000),
    });
    if (!javob.ok) throw new Error(`Fayl yuklanmadi: HTTP ${javob.status}`);
    return {
      buffer: Buffer.from(await javob.arrayBuffer()),
      nom: String(fayl.file_path).split('/').pop() || 'audio.oga',
    };
  }

  async sendDocument(chatId, buffer, nom, izoh = '') {
    const forma = new FormData();
    forma.append('chat_id', String(chatId));
    if (izoh) {
      forma.append('caption', izoh.slice(0, 1000));
      forma.append('parse_mode', 'HTML');
    }
    forma.append('document', new Blob([buffer]), nom);

    const javob = await fetch(`${this.asos}/sendDocument`, {
      method: 'POST',
      body: forma,
      signal: AbortSignal.timeout(120000),
    });
    return tekshir('sendDocument', javob, await javob.text());
  }
}

/**
 * Telegram javobini tekshiradi. JSON kelmasa (proksi, bloklash, HTML xato
 * sahifasi) — sababi ko'rinib turadigan xato beradi, "javob JSON emas" emas.
 */
function tekshir(metod, javob, xom) {
  let natija;
  try {
    natija = JSON.parse(xom);
  } catch {
    throw new Error(
      `Telegram ${metod}: HTTP ${javob.status}, javob JSON emas. ` +
        `Tokenni va internetni tekshiring. Javob boshi: ${xom.slice(0, 120)}`,
    );
  }

  if (!natija.ok) {
    const xato = new Error(`Telegram ${metod}: ${natija.description || `HTTP ${javob.status}`}`);
    xato.kod = natija.error_code ?? javob.status;
    xato.kutish = natija.parameters?.retry_after;
    throw xato;
  }
  return natija.result;
}

/** Uzun matnni qator chegarasida bo'ladi (HTML teglarini buzmaslikka harakat qiladi) */
function bolish(matn) {
  if (matn.length <= CHEGARA) return [matn || '…'];
  const bolaklar = [];
  let qoldiq = matn;
  while (qoldiq.length > CHEGARA) {
    let kesish = qoldiq.lastIndexOf('\n', CHEGARA);
    if (kesish < CHEGARA * 0.5) kesish = CHEGARA;
    bolaklar.push(qoldiq.slice(0, kesish));
    qoldiq = qoldiq.slice(kesish).replace(/^\n+/, '');
  }
  if (qoldiq) bolaklar.push(qoldiq);
  return bolaklar;
}
