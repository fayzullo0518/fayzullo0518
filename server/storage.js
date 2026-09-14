/**
 * Ma'lumotlarni saqlash qatlami — where the database document and the
 * uploaded files actually live.
 *
 * Two backends, chosen by the environment:
 *
 *   DATABASE_URL berilgan  → Postgres. Hamma narsa bazada: holat hujjati
 *                            ham, yuklangan fayllar ham. Server o'chib
 *                            yonganda ham, konteyner butunlay almashganda
 *                            ham hech narsa yo'qolmaydi. Diski yo'q bepul
 *                            hostlar uchun aynan shu kerak.
 *
 *   aks holda              → disk (DATA_DIR). Ulangan disk bo'lsa (Fly.io
 *                            volume, VPS) eng tez va eng sodda yo'l.
 *
 * Ikkalasi ham bir xil interfeysni beradi, shuning uchun ilovaning qolgan
 * qismi qaysi biri ishlayotganini bilmaydi.
 */
import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024;

/** Postgres'da fayl bazada yotadi, shuning uchun cheklov quyiroq */
const DEFAULT_PG_LIMIT_MB = 10;
const DEFAULT_DISK_LIMIT_MB = 50;

const limitFromEnv = (fallback) => {
  const value = Number(process.env.MAX_UPLOAD_MB);
  return (Number.isFinite(value) && value > 0 ? value : fallback) * MB;
};

/* ------------------------------------------------------------------ */
/* disk                                                                */
/* ------------------------------------------------------------------ */

function diskStorage(dataDir) {
  const stateFile = path.join(dataDir, 'db.json');
  const tmpFile = `${stateFile}.tmp`;
  const bakFile = `${stateFile}.bak`;
  const uploadDir = path.join(dataDir, 'uploads');

  const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
  const reviver = (key, value) => (FORBIDDEN.has(key) ? undefined : value);

  return {
    kind: 'disk',
    describe: dataDir,
    uploadDir,
    maxFileBytes: limitFromEnv(DEFAULT_DISK_LIMIT_MB),

    async init() {
      fs.mkdirSync(uploadDir, { recursive: true });
    },

    /** db.json, and the backup copy when the main file will not parse */
    async loadState() {
      for (const file of [stateFile, bakFile]) {
        try {
          if (!fs.existsSync(file)) continue;
          const loaded = JSON.parse(fs.readFileSync(file, 'utf8'), reviver);
          if (loaded && typeof loaded === 'object') {
            if (file === bakFile) console.warn('[storage] db.json buzilgan — zaxira nusxadan tiklandi');
            return loaded;
          }
        } catch (err) {
          console.warn(`[storage] ${path.basename(file)} o'qilmadi: ${err.message}`);
        }
      }
      return null;
    },

    /**
     * Atomic: the new copy lands in a temp file, the old one becomes the
     * backup, and only then does the temp file take its place.
     */
    async saveState(doc) {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tmpFile, JSON.stringify(doc, null, 2), { encoding: 'utf8', mode: 0o600 });
      if (fs.existsSync(stateFile)) fs.copyFileSync(stateFile, bakFile);
      fs.renameSync(tmpFile, stateFile);
    },

    async putFile(name, buffer) {
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, name), buffer);
    },

    // served by express.static, so this is only a fallback path
    async getFile(name) {
      const file = path.join(uploadDir, name);
      if (!fs.existsSync(file)) return null;
      return { buffer: fs.readFileSync(file), contentType: 'application/octet-stream' };
    },

    async close() {},
  };
}

/* ------------------------------------------------------------------ */
/* postgres                                                            */
/* ------------------------------------------------------------------ */

/**
 * Neon, Supabase and every other hosted Postgres insists on TLS. Their
 * certificates are signed by a root Node does not ship, so verification is
 * relaxed for the managed providers while the connection stays encrypted.
 * A plain local database needs no TLS at all.
 */
function sslFor(url) {
  if (/\bsslmode=disable\b/.test(url)) return false;
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (local && !/\bsslmode=require\b/.test(url)) return false;
  return { rejectUnauthorized: false };
}

async function postgresStorage(url) {
  let Pool;
  try {
    ({ Pool } = await import('pg'));
  } catch {
    throw new Error(
      "DATABASE_URL berilgan, lekin 'pg' kutubxonasi o'rnatilmagan.\n" +
        "  Tuzatish:  npm install --prefix server pg",
    );
  }

  const pool = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: Number(process.env.PGPOOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

  pool.on('error', (err) => console.error('[storage] postgres pool xatosi:', err.message));

  return {
    kind: 'postgres',
    describe: url.replace(/\/\/[^@]*@/, '//***@'),
    uploadDir: null,
    maxFileBytes: limitFromEnv(DEFAULT_PG_LIMIT_MB),

    async init() {
      // one row holds the whole document; files get a row each
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gmn_state (
          id         integer PRIMARY KEY,
          doc        jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT gmn_state_single_row CHECK (id = 1)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gmn_files (
          name         text PRIMARY KEY,
          content_type text NOT NULL,
          size         integer NOT NULL,
          bytes        bytea NOT NULL,
          created_at   timestamptz NOT NULL DEFAULT now()
        )
      `);
    },

    async loadState() {
      const { rows } = await pool.query('SELECT doc FROM gmn_state WHERE id = 1');
      return rows.length ? rows[0].doc : null;
    },

    async saveState(doc) {
      await pool.query(
        `INSERT INTO gmn_state (id, doc, updated_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        [JSON.stringify(doc)],
      );
    },

    async putFile(name, buffer, contentType = 'application/octet-stream') {
      await pool.query(
        `INSERT INTO gmn_files (name, content_type, size, bytes) VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE
           SET content_type = EXCLUDED.content_type,
               size = EXCLUDED.size,
               bytes = EXCLUDED.bytes`,
        [name, contentType, buffer.length, buffer],
      );
    },

    async getFile(name) {
      const { rows } = await pool.query(
        'SELECT bytes, content_type FROM gmn_files WHERE name = $1',
        [name],
      );
      if (!rows.length) return null;
      return { buffer: rows[0].bytes, contentType: rows[0].content_type };
    },

    async close() {
      await pool.end().catch(() => {});
    },
  };
}

/* ------------------------------------------------------------------ */

/**
 * @param {string} dataDir where the disk backend keeps its files
 * @returns the chosen backend, already initialised
 */
export async function createStorage(dataDir) {
  const url = String(process.env.DATABASE_URL || '').trim();
  const storage = url ? await postgresStorage(url) : diskStorage(dataDir);
  await storage.init();
  return storage;
}
