/**
 * Composes the read-only seed catalogue (extracted from katalg.pdf) with the
 * catalogues, devices and edits that administrators create at runtime.
 *
 *  - seed categories/products  → data/catalog.js  (never mutated)
 *  - custom categories/products → db.json          (fully editable)
 *  - edits to seed products     → db.productMeta   (field overrides)
 *  - removed seed products      → db.hiddenProducts
 */
import crypto from 'node:crypto';
import { categories as seedCategories, products as seedProducts } from './data/catalog.js';
import { readDb, writeDb } from './db.js';
import { SPEC_KEYS } from './data/reference.js';

const EDITABLE_PRODUCT_FIELDS = [
  'manualId',
  'model',
  'name',
  'subcategory',
  'summary',
  'image',
  'availability',
  'leadTime',
  'warranty',
  'origin',
  'price',
  'note',
  'featured',
  'category',
];

export const slugify = (value, fallback = 'item') =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;

export function normaliseSpecs(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((s) => ({
        label: String(s.label ?? '').trim().slice(0, 60),
        value: String(s.value ?? '').trim().slice(0, 160),
      }))
      .filter((s) => s.label && s.value)
      .slice(0, 12);
  }
  // "label|value;label|value" or one "label: value" per line
  return String(input)
    .split(/[;\n]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [label, ...rest] = chunk.includes('|') ? chunk.split('|') : chunk.split(':');
      return { label: (label || '').trim().slice(0, 60), value: rest.join(':').trim().slice(0, 160) };
    })
    .filter((s) => s.label && s.value)
    .slice(0, 12);
}

/**
 * The standard technical sheet every device shares.
 *
 * The labels come from SPEC_TEMPLATE and are identical for the whole
 * catalogue — only the values differ from device to device — so the product
 * page always renders the same rows in the same order. Anything a device
 * needs beyond the template goes into `specs` as a free label/value row.
 */
export function normaliseStandard(input, base = {}) {
  const out = { ...base };
  if (!input || typeof input !== 'object') return out;
  for (const key of SPEC_KEYS) {
    if (input[key] === undefined) continue;
    out[key] = String(input[key] ?? '').trim().slice(0, 200);
  }
  return out;
}

/**
 * Seed devices were imported before the standard sheet existed, so fill the
 * rows we can already answer from the catalogue data. The administrator fills
 * in the rest from the panel; empty rows simply render as “—”.
 */
function withStandard(product) {
  const standard = {
    manufacturer: product.origin || '',
    type: product.subcategory || '',
    standards: (product.certifications || []).join(' · '),
    warrantyTerm: product.warranty || '',
    ...(product.standard || {}),
  };
  return { ...product, standard };
}

/* ------------------------------------------------------------------ */
/* categories                                                          */
/* ------------------------------------------------------------------ */

export function getCategories() {
  const db = readDb();
  const custom = (db.categories || []).map((c) => ({ ...c, custom: true }));
  const hidden = new Set(db.hiddenCategories || []);
  return [...seedCategories.map((c) => ({ ...c, custom: false })), ...custom].filter(
    (c) => !hidden.has(c.id),
  );
}

export function getCategoryById(id) {
  return getCategories().find((c) => c.id === id) || null;
}

export function createCategory(payload) {
  const db = readDb();
  const name = String(payload.name || '').trim();
  if (!name) throw Object.assign(new Error('Catalogue name is required'), { status: 400 });

  let id = slugify(payload.id || name, 'catalogue');
  const taken = new Set(getCategories().map((c) => c.id));
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }

  const category = {
    id,
    name: name.slice(0, 80),
    tagline: String(payload.tagline || '').slice(0, 120),
    blurb: String(payload.blurb || '').slice(0, 400),
    accent: /^#[0-9a-f]{6}$/i.test(payload.accent || '') ? payload.accent : '#3B5BFF',
    icon: 'Boxes',
    custom: true,
    createdAt: new Date().toISOString(),
  };
  db.categories = [...(db.categories || []), category];
  writeDb(db);
  return category;
}

export function updateCategory(id, payload) {
  const db = readDb();
  const category = (db.categories || []).find((c) => c.id === id);
  if (!category) {
    throw Object.assign(new Error('Only catalogues you created can be edited'), { status: 400 });
  }
  for (const key of ['name', 'tagline', 'blurb']) {
    if (payload[key] !== undefined) category[key] = String(payload[key]).slice(0, 400);
  }
  if (/^#[0-9a-f]{6}$/i.test(payload.accent || '')) category.accent = payload.accent;
  writeDb(db);
  return category;
}

export function deleteCategory(id) {
  const db = readDb();
  const exists = (db.categories || []).some((c) => c.id === id);
  if (!exists) {
    throw Object.assign(new Error('Only catalogues you created can be removed'), { status: 400 });
  }
  const used = getProducts().filter((p) => p.category === id);
  if (used.length) {
    throw Object.assign(
      new Error(`Move or remove the ${used.length} device(s) in this catalogue first`),
      { status: 409 },
    );
  }
  db.categories = db.categories.filter((c) => c.id !== id);
  writeDb(db);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

export function getProducts() {
  const db = readDb();
  const hidden = new Set(db.hiddenProducts || []);
  const meta = db.productMeta || {};
  const custom = (db.products || []).map((p) => ({ ...p, custom: true }));
  return [...seedProducts.map((p) => ({ ...p, custom: false })), ...custom]
    .filter((p) => !hidden.has(p.id))
    .map((p) => withStandard({ ...p, ...(meta[p.id] || {}) }));
}

export function getProductById(id) {
  return getProducts().find((p) => p.id === id) || null;
}

export function createProduct(payload) {
  const db = readDb();
  const model = String(payload.model || '').trim();
  const name = String(payload.name || '').trim();
  const category = String(payload.category || '').trim();

  if (!model) throw Object.assign(new Error('Model is required'), { status: 400 });
  if (!name) throw Object.assign(new Error('Device name is required'), { status: 400 });
  if (!getCategoryById(category)) {
    throw Object.assign(new Error('Choose a catalogue for this device'), { status: 400 });
  }

  let id = slugify(payload.id || model, 'device');
  const taken = new Set(getProducts().map((p) => p.id));
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }

  const product = {
    id,
    model: model.slice(0, 60),
    name: name.slice(0, 120),
    category,
    subcategory: String(payload.subcategory || '').slice(0, 80) || 'General',
    image: String(payload.image || '').slice(0, 400) || '/products/placeholder.svg',
    summary: String(payload.summary || '').slice(0, 600),
    standard: normaliseStandard(payload.standard),
    specs: normaliseSpecs(payload.specs),
    featured: Boolean(payload.featured),
    sku: `NM-${category.slice(0, 3).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
    availability: payload.availability === 'On order' ? 'On order' : 'In stock',
    leadTime: String(payload.leadTime || '2–3 weeks').slice(0, 40),
    warranty: String(payload.warranty || '24 months').slice(0, 40),
    origin: String(payload.origin || 'Gold Med Nova').slice(0, 60),
    price: String(payload.price || '').slice(0, 60),
    manualId: String(payload.manualId || '').slice(0, 60) || null,
    images: Array.isArray(payload.images)
      ? payload.images.slice(0, 6).map((u) => String(u).slice(0, 400))
      : [],
    certifications: Array.isArray(payload.certifications)
      ? payload.certifications.slice(0, 6).map((c) => String(c).slice(0, 20))
      : ['CE'],
    custom: true,
    createdAt: new Date().toISOString(),
  };

  db.products = [...(db.products || []), product];
  writeDb(db);
  return product;
}

export function updateProduct(id, payload) {
  const db = readDb();
  const custom = (db.products || []).find((p) => p.id === id);

  if (custom) {
    for (const key of EDITABLE_PRODUCT_FIELDS) {
      if (payload[key] === undefined) continue;
      custom[key] = key === 'featured' ? Boolean(payload[key]) : String(payload[key]).slice(0, 600);
    }
    if (payload.specs !== undefined) custom.specs = normaliseSpecs(payload.specs);
    if (payload.standard !== undefined) {
      custom.standard = normaliseStandard(payload.standard, custom.standard || {});
    }
    if (payload.category && !getCategoryById(payload.category)) {
      throw Object.assign(new Error('Unknown catalogue'), { status: 400 });
    }
    writeDb(db);
    return withStandard({ ...custom, custom: true });
  }

  const base = seedProducts.find((p) => p.id === id);
  if (!base) throw Object.assign(new Error('Product not found'), { status: 404 });

  const meta = db.productMeta[id] || {};
  for (const key of EDITABLE_PRODUCT_FIELDS) {
    if (payload[key] === undefined) continue;
    meta[key] = key === 'featured' ? Boolean(payload[key]) : String(payload[key]).slice(0, 600);
  }
  if (payload.specs !== undefined) meta.specs = normaliseSpecs(payload.specs);
  if (payload.standard !== undefined) {
    meta.standard = normaliseStandard(payload.standard, meta.standard || {});
  }
  db.productMeta[id] = meta;
  writeDb(db);
  return withStandard({ ...base, ...meta, custom: false });
}

export function deleteProduct(id) {
  const db = readDb();
  const isCustom = (db.products || []).some((p) => p.id === id);
  if (isCustom) {
    db.products = db.products.filter((p) => p.id !== id);
  } else if (seedProducts.some((p) => p.id === id)) {
    db.hiddenProducts = [...new Set([...(db.hiddenProducts || []), id])];
  } else {
    throw Object.assign(new Error('Product not found'), { status: 404 });
  }
  delete db.productMeta[id];
  writeDb(db);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* derived views                                                       */
/* ------------------------------------------------------------------ */

export function categoriesWithCounts() {
  const all = getProducts();
  return getCategories().map((c) => {
    const items = all.filter((p) => p.category === c.id);
    return {
      ...c,
      count: items.length,
      cover: (items.find((p) => p.featured) || items[0])?.image || null,
    };
  });
}

export function featuredProducts() {
  const all = getProducts();
  return getCategories()
    .map((c) => {
      const items = all.filter((p) => p.category === c.id);
      return items.find((p) => p.featured) || items[0];
    })
    .filter(Boolean);
}


/* ------------------------------------------------------------------ */
/* service manuals                                                     */
/*                                                                     */
/* Manuals are never listed publicly. A visitor can only reach one by   */
/* its direct link (the printed QR code), or from the page of a device  */
/* an administrator has attached it to.                                 */
/* ------------------------------------------------------------------ */

/**
 * One instruction block: a heading, the explaining text, and an optional
 * photograph of the device at that step. The panel starts with a single block
 * and the “+” button adds as many more as the instruction needs.
 */
function cleanSections(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      heading: String(s.heading ?? '').trim().slice(0, 120),
      body: String(s.body ?? '').trim().slice(0, 4000),
      image: String(s.image ?? '').trim().slice(0, 400),
    }))
    .filter((s) => s.heading || s.body || s.image)
    .slice(0, 40);
}

function cleanList(input, max = 20, len = 300) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? '').trim().slice(0, len))
    .filter(Boolean)
    .slice(0, max);
}

export function getManuals() {
  return readDb().manuals || [];
}

export function getManualById(id) {
  return getManuals().find((m) => m.id === id) || null;
}

/** the manual attached to a device, if the administrator attached one */
export function getManualForProduct(productId) {
  const product = getProductById(productId);
  if (!product?.manualId) return null;
  return getManualById(product.manualId);
}

function manualPayload(payload, base = {}) {
  return {
    title: String(payload.title ?? base.title ?? '').trim().slice(0, 140),
    deviceModel: String(payload.deviceModel ?? base.deviceModel ?? '').trim().slice(0, 80),
    deviceName: String(payload.deviceName ?? base.deviceName ?? '').trim().slice(0, 140),
    language: ['uz', 'ru', 'en'].includes(payload.language)
      ? payload.language
      : base.language || 'uz',
    intro: String(payload.intro ?? base.intro ?? '').trim().slice(0, 3000),
    sections: payload.sections === undefined ? base.sections || [] : cleanSections(payload.sections),
    safety: payload.safety === undefined ? base.safety || [] : cleanList(payload.safety),
    contactName: String(payload.contactName ?? base.contactName ?? '').trim().slice(0, 120),
    contactPhone: String(payload.contactPhone ?? base.contactPhone ?? '').trim().slice(0, 40),
    productIds: payload.productIds === undefined
      ? base.productIds || []
      : cleanList(payload.productIds, 40, 60),
  };
}

/** keep product.manualId in sync with manual.productIds */
function syncAttachments(db, manualId, productIds) {
  const wanted = new Set(productIds);
  const all = getProducts();
  for (const product of all) {
    const shouldHave = wanted.has(product.id);
    const hasIt = product.manualId === manualId;
    if (shouldHave === hasIt) continue;

    const custom = (db.products || []).find((p) => p.id === product.id);
    if (custom) {
      custom.manualId = shouldHave ? manualId : null;
    } else {
      const meta = db.productMeta[product.id] || {};
      meta.manualId = shouldHave ? manualId : null;
      db.productMeta[product.id] = meta;
    }
  }
}

export function createManual(payload, author = '') {
  const db = readDb();
  const fields = manualPayload(payload);
  if (!fields.title) {
    throw Object.assign(new Error('Manual title is required'), { status: 400 });
  }

  let id = slugify(payload.id || fields.deviceModel || fields.title, 'manual');
  const taken = new Set(getManuals().map((m) => m.id));
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }

  const manual = {
    id,
    ...fields,
    createdBy: String(author).slice(0, 80),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.manuals = [...(db.manuals || []), manual];
  syncAttachments(db, id, manual.productIds);
  writeDb(db);
  return manual;
}

export function updateManual(id, payload) {
  const db = readDb();
  const manual = (db.manuals || []).find((m) => m.id === id);
  if (!manual) throw Object.assign(new Error('Manual not found'), { status: 404 });

  Object.assign(manual, manualPayload(payload, manual));
  manual.updatedAt = new Date().toISOString();
  syncAttachments(db, id, manual.productIds);
  writeDb(db);
  return manual;
}

export function deleteManual(id) {
  const db = readDb();
  if (!(db.manuals || []).some((m) => m.id === id)) {
    throw Object.assign(new Error('Manual not found'), { status: 404 });
  }
  syncAttachments(db, id, []);
  db.manuals = db.manuals.filter((m) => m.id !== id);
  writeDb(db);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* contact page content (editable by administrators)                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_CONTACTS = {
  brand: 'Gold Med Nova',
  legal: 'Gold Med Nova Medical Devices',
  tagline: 'Medical equipment marketplace',
  address: 'Toshkent, O‘zbekiston',
  admins: [
    {
      id: 'fayzullo',
      name: 'Fayzullo',
      role: 'Head of Sales · Super admin',
      phone: '+998 88 210 09 24',
      phoneHref: 'tel:+998882100924',
      initials: 'F',
    },
    {
      id: 'sonyun',
      name: 'SonYun',
      role: 'Equipment consultant · Admin',
      phone: '+998 95 776 45 49',
      phoneHref: 'tel:+998957764549',
      initials: 'S',
    },
  ],
  channels: [
    {
      id: 'instagram',
      label: 'Instagram',
      handle: '@medservis.uz',
      url: 'https://instagram.com/medservis.uz',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      handle: '@fayzullo0518',
      url: 'https://t.me/fayzullo0518',
    },
    {
      id: 'email',
      label: 'Email',
      handle: 'fayzulloe17@gmail.com',
      url: 'mailto:fayzulloe17@gmail.com',
    },
  ],
};

const telHref = (phone) => 'tel:' + String(phone).replace(/[^\d+]/g, '');

export function getContacts() {
  const stored = readDb().contact;
  return stored ? { ...DEFAULT_CONTACTS, ...stored } : { ...DEFAULT_CONTACTS };
}

export function updateContacts(payload) {
  const db = readDb();
  const current = getContacts();

  const admins = Array.isArray(payload.admins)
    ? payload.admins.slice(0, 6).map((a, i) => {
        const name = String(a.name ?? '').trim().slice(0, 60) || `Admin ${i + 1}`;
        const phone = String(a.phone ?? '').trim().slice(0, 40);
        return {
          id: slugify(a.id || name, `admin-${i + 1}`),
          name,
          role: String(a.role ?? '').trim().slice(0, 80),
          phone,
          phoneHref: telHref(phone),
          initials: name.slice(0, 1).toUpperCase(),
        };
      })
    : current.admins;

  const channels = Array.isArray(payload.channels)
    ? payload.channels.slice(0, 6).map((c, i) => ({
        id: slugify(c.id || c.label || `channel-${i + 1}`, `channel-${i + 1}`),
        label: String(c.label ?? '').trim().slice(0, 40),
        handle: String(c.handle ?? '').trim().slice(0, 120),
        url: String(c.url ?? '').trim().slice(0, 300),
      }))
    : current.channels;

  db.contact = {
    brand: String(payload.brand ?? current.brand).slice(0, 60),
    legal: String(payload.legal ?? current.legal).slice(0, 120),
    tagline: String(payload.tagline ?? current.tagline).slice(0, 160),
    address: String(payload.address ?? current.address).slice(0, 160),
    admins,
    channels,
  };
  writeDb(db);
  return getContacts();
}
