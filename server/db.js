import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { products } from './data/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the database and the uploaded files live.
 *
 * On a host with a mounted volume set DATA_DIR to the mount point — otherwise
 * a redeploy throws the register away with the container.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const DB_FILE = path.join(DATA_DIR, 'db.json');
const TMP_FILE = `${DB_FILE}.tmp`;
const BAK_FILE = `${DB_FILE}.bak`;

/* ------------------------------------------------------------------ */
/* password hashing (scrypt — no native deps)                          */
/*                                                                     */
/* N is raised above the Node default and the work happens off the     */
/* event loop, so a burst of sign-in attempts cannot stall the server. */
/* ------------------------------------------------------------------ */

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;

const scrypt = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, KEYLEN, SCRYPT, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });

/** `scrypt:N:r:p:salt:digest` — the parameters travel with the hash */
export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt);
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt}:${derived.toString('hex')}`;
}

/**
 * Verifies against both the current format and the legacy `salt:digest`
 * pairs written before the parameters were recorded.
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;

  let salt;
  let digest;
  let params = SCRYPT;

  if (stored.startsWith('scrypt:')) {
    const [, N, r, p, s, d] = stored.split(':');
    if (!s || !d) return false;
    params = { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
    salt = s;
    digest = d;
  } else {
    [salt, digest] = stored.split(':');
    if (!salt || !digest) return false;
    params = { N: 16384, r: 8, p: 1, maxmem: SCRYPT.maxmem };
  }

  let derived;
  try {
    derived = await new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, KEYLEN, params, (err, out) =>
        err ? reject(err) : resolve(out),
      );
    });
  } catch {
    return false;
  }

  const a = derived;
  const b = Buffer.from(digest, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Burns the same amount of CPU as a real check without comparing anything.
 * Sign-in calls it when the username does not exist so that a wrong username
 * and a wrong password take the same time to answer.
 */
export async function dummyVerify() {
  await scrypt('no-such-user', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').catch(() => {});
  return false;
}

/* ------------------------------------------------------------------ */
/* first-boot administrator                                            */
/*                                                                     */
/* No password is ever compiled into this file. The first administrator */
/* comes from the environment, and when nothing is set a random one is  */
/* generated and printed to the log exactly once.                       */
/* ------------------------------------------------------------------ */

export const generatedPasswords = [];

const envName = (value, fallback) => String(value || '').trim() || fallback;

async function buildSuperAdmin() {
  const username = envName(process.env.ADMIN_USERNAME, 'fayzullo');
  const supplied = String(process.env.ADMIN_PASSWORD || '');
  const password = supplied || crypto.randomBytes(12).toString('base64url');

  if (!supplied) {
    generatedPasswords.push({ username, password });
  }

  return {
    id: 'usr-super-fayzullo',
    name: envName(process.env.ADMIN_NAME, 'Fayzullo'),
    username,
    email: envName(process.env.ADMIN_EMAIL, 'admin@goldmednova.uz'),
    phone: envName(process.env.ADMIN_PHONE, ''),
    role: 'superadmin',
    status: 'active',
    organization: 'Gold Med Nova',
    twoFactor: true,
    createdAt: new Date().toISOString(),
    lastActive: null,
    // a generated password must be replaced; a supplied one is the owner's choice
    mustChangePassword: !supplied,
    passwordChangedAt: new Date().toISOString(),
    password: await hashPassword(password),
  };
}

/**
 * The three colleagues from the original hand-off document. They are seeded
 * with no password at all, so nobody can sign in as them until the super
 * admin sets one from the panel. Set SEED_TEAM=0 to leave them out entirely.
 */
function seedTeam() {
  if (String(process.env.SEED_TEAM || '1') === '0') return [];
  const at = new Date().toISOString();
  return [
    {
      id: 'usr-sonyun', name: 'SonYun', username: 'SonYun',
      email: 'sonyun@goldmednova.uz', phone: '', role: 'admin',
      organization: 'Gold Med Nova',
    },
    {
      id: 'usr-manager-dilnoza', name: 'Dilnoza Karimova', username: 'dilnoza',
      email: 'dilnoza@goldmednova.uz', phone: '', role: 'manager',
      organization: 'Gold Med Nova · Sales',
    },
    {
      id: 'usr-viewer-otabek', name: 'Otabek Yusupov', username: 'otabek',
      email: 'otabek@goldmednova.uz', phone: '', role: 'viewer',
      organization: 'Gold Med Nova · Service',
    },
  ].map((u) => ({
    ...u,
    status: 'invited',
    twoFactor: false,
    createdAt: at,
    lastActive: null,
    mustChangePassword: false,
    passwordChangedAt: at,
    // no usable credential — verifyPassword rejects null outright
    password: null,
  }));
}

const REGIONS = [
  'Toshkent', 'Farg‘ona', 'Samarqand', 'Andijon', 'Namangan',
  'Buxoro', 'Qashqadaryo', 'Xorazm', 'Navoiy', 'Surxondaryo',
];
const CLINICS = [
  'Respublika ixtisoslashtirilgan markazi', 'Shahar ko‘p tarmoqli shifoxonasi',
  'Tuman markaziy shifoxonasi', 'Perinatal markaz', 'Onkologiya dispanseri',
  'Xususiy diagnostika markazi', 'Stomatologiya poliklinikasi',
];

/** demo enquiries, so a fresh install is not an empty dashboard */
function seedInquiries() {
  if (String(process.env.SEED_DEMO_DATA || '1') === '0') return [];
  const picks = products.filter((p) => p.featured).concat(products.slice(0, 18));
  return picks.slice(0, 24).map((p, i) => ({
    id: `inq-${String(i + 1).padStart(4, '0')}`,
    productId: p.id,
    productModel: p.model,
    productName: p.name,
    category: p.category,
    contactName: `${CLINICS[i % CLINICS.length]}`,
    region: REGIONS[i % REGIONS.length],
    phone: `+998 9${i % 9} ${100 + i} ${10 + (i % 80)} ${20 + (i % 70)}`,
    email: `procurement${i + 1}@clinic.uz`,
    quantity: 1 + (i % 4),
    message: 'Narx taklifi va yetkazib berish muddati bo‘yicha ma‘lumot kerak.',
    status: ['new', 'contacted', 'quoted', 'won'][i % 4],
    assignedTo: i % 2 === 0 ? 'usr-super-fayzullo' : 'usr-sonyun',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * (i % 30) - i * 3600_000).toISOString(),
  }));
}

async function defaultDb() {
  return {
    version: 3,
    users: [await buildSuperAdmin(), ...seedTeam()],
    inquiries: seedInquiries(),
    categories: [],        // catalogues created by administrators
    products: [],          // devices created by administrators
    hiddenProducts: [],    // seed devices removed from the market
    hiddenCategories: [],
    manuals: [],           // service manuals, reachable only by their QR link
    assets: [],            // monitored machines in the field (apparat monitoringi)
    notifications: [],     // condition changes waiting to be seen by an admin
    apiKeys: [],           // integration keys handed to partner sites
    contact: null,         // contact page overrides
    productMeta: {},
    activity: [],
  };
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

let cache = null;

/** db.json is ours, but a reviver still costs nothing */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const safeReviver = (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value);

const parse = (raw) => JSON.parse(raw, safeReviver);

function fillMissingCollections(db) {
  db.categories ??= [];
  db.products ??= [];
  db.hiddenProducts ??= [];
  db.hiddenCategories ??= [];
  db.manuals ??= [];
  db.assets ??= [];
  db.notifications ??= [];
  db.apiKeys ??= [];
  if (db.contact === undefined) db.contact = null;
  db.productMeta ??= {};
  db.inquiries ??= [];
  db.activity ??= [];
  db.users ??= [];
  return db;
}

/**
 * Reads db.json, falling back to the backup a previous write left behind.
 *
 * Reseeding is the last resort: it hands out a brand-new random administrator
 * password rather than silently restoring a known one.
 */
export function readDb() {
  if (cache) return cache;

  for (const file of [DB_FILE, BAK_FILE]) {
    try {
      if (!fs.existsSync(file)) continue;
      const loaded = parse(fs.readFileSync(file, 'utf8'));
      if (!loaded || typeof loaded !== 'object') continue;
      cache = fillMissingCollections(loaded);
      if (file === BAK_FILE) {
        console.warn('[db] db.json unreadable — recovered from the backup copy');
        writeDb(cache);
      }
      return cache;
    } catch (err) {
      console.warn(`[db] could not read ${path.basename(file)}: ${err.message}`);
    }
  }

  throw new Error('[db] no database on disk — call initDb() before readDb()');
}

/**
 * Boots the database. Kept separate from readDb because seeding the first
 * administrator hashes a password, and hashing is asynchronous.
 */
export async function initDb() {
  if (cache) return cache;
  for (const file of [DB_FILE, BAK_FILE]) {
    if (fs.existsSync(file)) {
      try {
        return readDb();
      } catch {
        /* fall through to reseed */
      }
    }
  }
  cache = await defaultDb();
  writeDb(cache);
  return cache;
}

/**
 * Atomic write: a full copy lands in a temp file, the previous database
 * becomes the backup, and only then does the temp file take its place. A
 * crash mid-write can no longer leave a truncated db.json behind — which
 * used to mean a silent reseed and the loss of every record.
 */
export function writeDb(next = cache) {
  cache = next;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TMP_FILE, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, BAK_FILE);
    fs.renameSync(TMP_FILE, DB_FILE);
  } catch (err) {
    console.warn('[db] could not persist db.json:', err.message);
  }
  return cache;
}

export function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return { ...rest, hasPassword: Boolean(password) };
}

export function logActivity(type, actor, text) {
  const db = readDb();
  db.activity.unshift({
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    type,
    actor: String(actor ?? '').slice(0, 80),
    text: String(text ?? '').slice(0, 240),
    at: new Date().toISOString(),
  });
  db.activity = db.activity.slice(0, 60);
  writeDb(db);
}
