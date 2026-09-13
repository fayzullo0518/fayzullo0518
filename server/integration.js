/**
 * Integratsiya — how another website talks to this one.
 *
 * A partner site is given an API key from the panel. The key is shown once,
 * stored only as a SHA-256 hash, carries a scope list, and can be suspended
 * or deleted at any time. Everything it can reach lives under /api/v1.
 *
 *   Authorization: Bearer gmn_ab12cd34_<secret>
 *   X-API-Key: gmn_ab12cd34_<secret>
 */
import crypto from 'node:crypto';
import { readDb, writeDb, logActivity } from './db.js';

export const SCOPES = [
  { id: 'catalog:read', name: 'Katalog va apparatlarni o‘qish' },
  { id: 'assets:read', name: 'Monitoring reyestrini o‘qish' },
  { id: 'manuals:read', name: 'Yo‘riqnomalarni o‘qish' },
  { id: 'inquiries:write', name: 'Buyurtma so‘rovini yuborish' },
];

const SCOPE_IDS = SCOPES.map((s) => s.id);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const str = (value, max = 120) => String(value ?? '').trim().slice(0, max);

/** what the panel may show: everything except the secret itself */
export const publicKey = (key) => {
  if (!key) return null;
  const { hash, ...rest } = key;
  return rest;
};

export function getApiKeys() {
  return (readDb().apiKeys || []).map(publicKey);
}

/**
 * Mint a key. The plaintext is returned exactly once — after this call the
 * database holds nothing but its hash.
 */
export function createApiKey({ name, scopes, origin }, author = '') {
  const db = readDb();
  const label = str(name, 80);
  if (!label) throw Object.assign(new Error('Kalit nomi majburiy'), { status: 400 });

  const wanted = Array.isArray(scopes) ? scopes.filter((s) => SCOPE_IDS.includes(s)) : [];
  if (!wanted.length) {
    throw Object.assign(new Error('Kamida bitta ruxsat tanlanishi kerak'), { status: 400 });
  }

  const prefix = crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  const plaintext = `gmn_${prefix}_${secret}`;

  const key = {
    id: `key-${crypto.randomUUID().slice(0, 8)}`,
    name: label,
    prefix,
    hash: sha256(plaintext),
    scopes: wanted,
    origin: str(origin, 200),
    status: 'active',
    requests: 0,
    lastUsedAt: null,
    createdBy: str(author, 80),
    createdAt: new Date().toISOString(),
  };

  db.apiKeys = [key, ...(db.apiKeys || [])];
  writeDb(db);
  logActivity('integration', author, `${author} “${label}” integratsiya kalitini yaratdi`);

  // the only time the caller ever sees the secret
  return { ...publicKey(key), key: plaintext };
}

export function updateApiKey(id, patch, author = '') {
  const db = readDb();
  const key = (db.apiKeys || []).find((k) => k.id === id);
  if (!key) throw Object.assign(new Error('Kalit topilmadi'), { status: 404 });

  if (patch.name !== undefined) key.name = str(patch.name, 80) || key.name;
  if (patch.origin !== undefined) key.origin = str(patch.origin, 200);
  if (patch.status && ['active', 'suspended'].includes(patch.status)) key.status = patch.status;
  if (Array.isArray(patch.scopes)) {
    const wanted = patch.scopes.filter((s) => SCOPE_IDS.includes(s));
    if (wanted.length) key.scopes = wanted;
  }
  writeDb(db);
  logActivity('integration', author, `${author} “${key.name}” kalitini o‘zgartirdi`);
  return publicKey(key);
}

export function deleteApiKey(id, author = '') {
  const db = readDb();
  const key = (db.apiKeys || []).find((k) => k.id === id);
  if (!key) throw Object.assign(new Error('Kalit topilmadi'), { status: 404 });
  db.apiKeys = db.apiKeys.filter((k) => k.id !== id);
  writeDb(db);
  logActivity('integration', author, `${author} “${key.name}” kalitini o‘chirdi`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* the middleware partner requests pass through                        */
/* ------------------------------------------------------------------ */

const USAGE_FLUSH_MS = 30_000;
let usageTimer = null;

/** batches the "requests" counter so a busy key does not thrash the disk */
function scheduleUsageFlush() {
  if (usageTimer) return;
  usageTimer = setTimeout(() => {
    usageTimer = null;
    try {
      writeDb();
    } catch (err) {
      console.warn('[integration] could not flush key usage:', err.message);
    }
  }, USAGE_FLUSH_MS);
  usageTimer.unref?.();
}

function presentedKey(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const apiKeyHeader = req.headers['x-api-key'];
  return apiKeyHeader ? String(apiKeyHeader).trim() : null;
}

/**
 * @param {string} scope the permission this route needs
 */
export function requireApiKey(scope) {
  return (req, res, next) => {
    const presented = presentedKey(req);
    if (!presented) {
      return res.status(401).json({ error: 'API kalit yuborilmadi (X-API-Key sarlavhasi)' });
    }

    const db = readDb();
    const hash = sha256(presented);
    const key = (db.apiKeys || []).find((k) => {
      if (k.hash.length !== hash.length) return false;
      return crypto.timingSafeEqual(Buffer.from(k.hash, 'hex'), Buffer.from(hash, 'hex'));
    });

    if (!key) return res.status(401).json({ error: 'API kalit noto‘g‘ri' });
    if (key.status !== 'active') return res.status(403).json({ error: 'API kalit to‘xtatilgan' });
    if (!key.scopes.includes(scope)) {
      return res.status(403).json({ error: `Bu kalitda “${scope}” ruxsati yo‘q` });
    }

    // an allow-listed origin, when the partner pinned one
    if (key.origin && req.headers.origin && req.headers.origin !== key.origin) {
      return res.status(403).json({ error: 'Bu manzildan foydalanishga ruxsat yo‘q' });
    }

    // The usage counter is bookkeeping, not data worth a synchronous write
    // of the whole database on every partner request — that alone was enough
    // to stall the server under a burst. Flush it at most twice a minute.
    key.requests = (key.requests || 0) + 1;
    key.lastUsedAt = new Date().toISOString();
    scheduleUsageFlush();

    req.apiKey = publicKey(key);
    return next();
  };
}
