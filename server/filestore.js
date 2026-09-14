/**
 * Fayl ombori — where uploaded photographs, contracts and invoices live.
 *
 * These are the bytes that make a server expensive: a VPS charges for fast
 * SSD, and a registry full of 50 MB device photographs eats it quickly.
 * Object storage costs a fraction of the same gigabyte, so the files can sit
 * on cheap storage while the main server keeps only the application and the
 * database.
 *
 * Three backends:
 *
 *   S3_BUCKET berilgan  → S3'ga mos ombor. Arzon gigabayt. Bu MinIO bo'lishi
 *                         mumkin (o'zingizning ikkinchi arzon serveringizda,
 *                         ma'lumot O'zbekistonda qoladi), yoki Cloudflare R2,
 *                         Backblaze B2 va boshqalar.
 *
 *   DATABASE_URL        → Postgres. Alohida ombor sozlanmaganda.
 *
 *   aks holda           → disk (DATA_DIR/uploads).
 *
 * FILE_ENCRYPTION_KEY berilsa, har bir fayl serverdan chiqishidan OLDIN
 * AES-256-GCM bilan shifrlanadi. Kalit faqat asosiy serverda turadi, ya'ni
 * ombor serveriga kirgan buzg'unchi o'qib bo'lmaydigan baytlarni topadi.
 * Shifrlash GCM bo'lgani uchun fayl o'zgartirilsa ham darrov bilinadi.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MB = 1024 * 1024;

/* ------------------------------------------------------------------ */
/* shifrlash                                                           */
/* ------------------------------------------------------------------ */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAGIC = Buffer.from('GMN1'); // so an encrypted blob is recognisable

function readKey() {
  const raw = String(process.env.FILE_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;

  let key;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new Error(
      'FILE_ENCRYPTION_KEY 32 baytli base64 bo‘lishi kerak.\n' +
        '  Yangisini yarating:  npm run secret:files',
    );
  }
  return key;
}

/** `GMN1 | iv | tag | ciphertext` */
function encrypt(key, plain) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

function decrypt(key, blob) {
  // files written before a key was configured stay readable
  if (blob.length < MAGIC.length || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    return blob;
  }
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = blob.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const body = blob.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  // throws when the bytes were tampered with — that is the point of GCM
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/**
 * Wraps a backend so everything written is encrypted and everything read is
 * decrypted, without the backend knowing anything about it.
 */
function withEncryption(backend, key) {
  if (!key) return backend;
  return {
    ...backend,
    encrypted: true,
    async put(name, buffer, contentType) {
      return backend.put(name, encrypt(key, buffer), contentType);
    },
    async get(name) {
      const found = await backend.get(name);
      if (!found) return null;
      try {
        return { ...found, buffer: decrypt(key, found.buffer) };
      } catch {
        // wrong key, or somebody edited the bytes in the store
        throw new Error(`“${name}” faylini ochib bo‘lmadi — kalit noto‘g‘ri yoki fayl o‘zgartirilgan`);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* disk                                                                */
/* ------------------------------------------------------------------ */

function diskFiles(dataDir) {
  const dir = path.join(dataDir, 'uploads');
  return {
    kind: 'disk',
    describe: dir,
    maxBytes: 50 * MB,
    async init() {
      fs.mkdirSync(dir, { recursive: true });
    },
    async put(name, buffer) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), buffer);
    },
    async get(name) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) return null;
      return { buffer: fs.readFileSync(file), contentType: null };
    },
    async remove(name) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
    async close() {},
  };
}

/* ------------------------------------------------------------------ */
/* postgres                                                            */
/* ------------------------------------------------------------------ */

function postgresFiles(pool) {
  return {
    kind: 'postgres',
    describe: 'Postgres (gmn_files)',
    maxBytes: 10 * MB,
    async init() {
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
    async put(name, buffer, contentType = 'application/octet-stream') {
      await pool.query(
        `INSERT INTO gmn_files (name, content_type, size, bytes) VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE
           SET content_type = EXCLUDED.content_type,
               size = EXCLUDED.size,
               bytes = EXCLUDED.bytes`,
        [name, contentType, buffer.length, buffer],
      );
    },
    async get(name) {
      const { rows } = await pool.query(
        'SELECT bytes, content_type FROM gmn_files WHERE name = $1',
        [name],
      );
      if (!rows.length) return null;
      return { buffer: rows[0].bytes, contentType: rows[0].content_type };
    },
    async remove(name) {
      await pool.query('DELETE FROM gmn_files WHERE name = $1', [name]);
    },
    async close() {},
  };
}

/* ------------------------------------------------------------------ */
/* s3-compatible                                                       */
/* ------------------------------------------------------------------ */

async function s3Files() {
  let S3Client;
  let PutObjectCommand;
  let GetObjectCommand;
  let DeleteObjectCommand;
  let HeadBucketCommand;
  try {
    ({ S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } =
      await import('@aws-sdk/client-s3'));
  } catch {
    throw new Error(
      "S3_BUCKET berilgan, lekin '@aws-sdk/client-s3' o‘rnatilmagan.\n" +
        '  Tuzatish:  npm install --prefix server @aws-sdk/client-s3',
    );
  }

  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const region = process.env.S3_REGION || 'auto';
  const prefix = String(process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');

  const client = new S3Client({
    region,
    endpoint,
    // MinIO and most self-hosted stores need path style; R2 and B2 accept it
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'true') !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  });

  const keyFor = (name) => (prefix ? `${prefix}/${name}` : name);

  const readAll = async (stream) => {
    if (typeof stream.transformToByteArray === 'function') {
      return Buffer.from(await stream.transformToByteArray());
    }
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  };

  return {
    kind: 's3',
    describe: `${endpoint || 's3'} · ${bucket}${prefix ? `/${prefix}` : ''}`,
    maxBytes: 50 * MB,

    async init() {
      // fail at boot rather than on the first upload months later
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },

    async put(name, buffer, contentType = 'application/octet-stream') {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: keyFor(name),
          Body: buffer,
          ContentType: contentType,
        }),
      );
    },

    async get(name) {
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: keyFor(name) }),
        );
        return { buffer: await readAll(out.Body), contentType: out.ContentType || null };
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },

    async remove(name) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyFor(name) }));
    },

    async close() {
      client.destroy?.();
    },
  };
}

/* ------------------------------------------------------------------ */

/**
 * @param {string} dataDir  disk backend uchun papka
 * @param {object|null} pool  ochiq Postgres pool, bo'lsa
 */
export async function createFileStore(dataDir, pool) {
  const key = readKey();

  let backend;
  if (process.env.S3_BUCKET) backend = await s3Files();
  else if (pool) backend = postgresFiles(pool);
  else backend = diskFiles(dataDir);

  await backend.init();

  if (backend.kind === 's3' && !key) {
    console.warn(
      '\n  [xavfsizlik] Fayllar tashqi omborga SHIFRLANMAGAN holda yuborilmoqda.\n' +
        '  Ombor serveriga kirgan odam shartnomalarni o‘qiy oladi.\n' +
        '  Kalit yarating va .env ga qo‘ying:  npm run secret:files\n',
    );
  }

  const limit = Number(process.env.MAX_UPLOAD_MB);
  if (Number.isFinite(limit) && limit > 0) backend.maxBytes = limit * MB;

  return withEncryption(backend, key);
}

export const __test = { encrypt, decrypt, MAGIC };
