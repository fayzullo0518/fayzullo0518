import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { products } from './data/catalog.js';
import { createStorage } from './storage.js';

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

/** the chosen backend — disk or Postgres; set by initDb() */
let storage = null;

export const getStorage = () => storage;

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
    files: {},           // what each uploaded file is: photo or document
    activity: [],
  };
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

let cache = null;

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
  db.files ??= {};
  db.inquiries ??= [];
  db.activity ??= [];
  db.users ??= [];
  return db;
}

/**
 * The in-memory copy is the one the application reads, and it is handed back
 * synchronously — every caller in the codebase expects that. Persisting it is
 * what happens in the background.
 */
export function readDb() {
  if (cache) return cache;
  throw new Error('[db] baza hali yuklanmagan — avval initDb() chaqiring');
}

/**
 * Boots the database: picks the backend, loads what is already stored, and
 * seeds a fresh one only when there is genuinely nothing there.
 *
 * Kept asynchronous because both loading from Postgres and hashing the first
 * administrator's password are asynchronous; readDb() stays synchronous.
 */
export async function initDb() {
  if (cache) return cache;

  storage = await createStorage(DATA_DIR);

  const loaded = await storage.loadState();
  if (loaded && typeof loaded === 'object') {
    cache = fillMissingCollections(loaded);
    return cache;
  }

  cache = await defaultDb();
  await persist();
  return cache;
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/*                                                                     */
/* Writes are coalesced: a burst of changes inside one request becomes  */
/* a single save. Postgres in particular is a network round trip, and   */
/* doing one per field edit would be both slow and wasteful.            */
/* ------------------------------------------------------------------ */

const FLUSH_MS = Number(process.env.DB_FLUSH_MS) || 250;

let flushTimer = null;
let writing = null;
let pendingAgain = false;

async function persist() {
  if (!storage || !cache) return;
  if (writing) {
    // a save is already in flight — make sure another one follows it
    pendingAgain = true;
    return writing;
  }
  writing = (async () => {
    try {
      await storage.saveState(cache);
    } catch (err) {
      console.error('[db] saqlab bo‘lmadi:', err.message);
    } finally {
      writing = null;
    }
    if (pendingAgain) {
      pendingAgain = false;
      await persist();
    }
  })();
  return writing;
}

/**
 * Updates the in-memory copy now and schedules the save.
 *
 * Returning synchronously is deliberate: all 30-odd call sites across the
 * stores are synchronous, and making them await would be a rewrite with far
 * more room for mistakes than this costs. The window in which a crash could
 * lose the very last change is a quarter of a second, and flushDb() closes
 * even that on a clean shutdown.
 */
export function writeDb(next = cache) {
  cache = next;
  if (flushTimer) return cache;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    persist();
  }, FLUSH_MS);
  flushTimer.unref?.();
  return cache;
}

/** waits for everything outstanding to reach the backend */
export async function flushDb() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await persist();
  if (writing) await writing;
}

export async function closeDb() {
  await flushDb();
  if (storage) await storage.close();
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
