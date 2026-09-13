/**
 * Apparat monitoringi — the fleet register.
 *
 * A "product" is a catalogue entry on the marketplace. An "asset" is one
 * physical machine that was sold and installed somewhere: it carries its own
 * photographs, purchase documents, warranty dates, three-level classification,
 * the organisation and district it stands in, its map coordinates and its
 * current working condition.
 *
 * Every condition change — from the panel or from the public QR page — is
 * written to a notification feed that all signed-in administrators poll.
 */
import crypto from 'node:crypto';
import { readDb, writeDb } from './db.js';
import { findClassification } from './data/classification.js';
import { districtName as lookupDistrict, regionName as lookupRegion } from './data/regions.js';
import { STATUS_IDS, STATUSES_NEEDING_REASON } from './data/reference.js';

/** photographs per asset may total at most 50 MB */
export const MAX_ASSET_IMAGE_BYTES = 50 * 1024 * 1024;

const str = (value, max = 200) => String(value ?? '').trim().slice(0, max);

/** keep only YYYY-MM-DD, so the value survives a round trip through <input type="date"> */
const date = (value) => {
  const text = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

const num = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const coord = (value, limit) => {
  const n = num(value);
  if (n === null) return null;
  return Math.abs(n) <= limit ? Number(n.toFixed(6)) : null;
};

/** [{ url, name, size }] — anything else is dropped */
function cleanFiles(input, max = 40) {
  if (!Array.isArray(input)) return [];
  return input
    .map((f) => ({
      url: str(f?.url, 400),
      name: str(f?.name, 160),
      size: Math.max(0, Number(f?.size) || 0),
      type: str(f?.type, 80),
    }))
    .filter((f) => f.url)
    .slice(0, max);
}

function cleanFile(input) {
  if (!input || !input.url) return null;
  return cleanFiles([input], 1)[0] || null;
}

export const imagesBytes = (images) => images.reduce((sum, img) => sum + (img.size || 0), 0);

/* ------------------------------------------------------------------ */
/* normalisation                                                       */
/* ------------------------------------------------------------------ */

function normalise(payload, base = {}) {
  const pick = (key, fn, ...args) =>
    payload[key] === undefined ? base[key] ?? fn('', ...args) : fn(payload[key], ...args);

  const status = STATUS_IDS.includes(payload.status)
    ? payload.status
    : STATUS_IDS.includes(base.status)
      ? base.status
      : 'soz';

  const images = payload.images === undefined ? base.images || [] : cleanFiles(payload.images);

  return {
    /* --- classification --- */
    classGroup: pick('classGroup', str, 60),
    classSection: pick('classSection', str, 120),
    classItem: pick('classItem', str, 200),

    /* --- photographs --- */
    images,

    /* --- manufacturing --- */
    manufacturer: pick('manufacturer', str, 160),
    manufacturerCountry: pick('manufacturerCountry', str, 80),
    productionCountry: pick('productionCountry', str, 80),

    /* --- identity --- */
    name: pick('name', str, 200),
    model: pick('model', str, 120),
    serial: pick('serial', str, 120),

    /* --- documents --- */
    contractFile: payload.contractFile === undefined ? base.contractFile ?? null : cleanFile(payload.contractFile),
    invoiceFile: payload.invoiceFile === undefined ? base.invoiceFile ?? null : cleanFile(payload.invoiceFile),
    extraFiles: payload.extraFiles === undefined ? base.extraFiles || [] : cleanFiles(payload.extraFiles, 20),

    /* --- dates and money --- */
    producedAt: pick('producedAt', date),
    purchasedAt: pick('purchasedAt', date),
    warrantyUntil: pick('warrantyUntil', date),
    soldAt: pick('soldAt', date),
    price: pick('price', str, 60),

    /* --- location --- */
    region: pick('region', str, 80) || 'fargona',
    district: pick('district', str, 60),
    districtOther: pick('districtOther', str, 160),
    organization: pick('organization', str, 200),
    organizationNote: pick('organizationNote', str, 300),
    lat: payload.lat === undefined ? (base.lat ?? null) : coord(payload.lat, 90),
    lng: payload.lng === undefined ? (base.lng ?? null) : coord(payload.lng, 180),

    /* --- condition --- */
    status,
    faultReason: pick('faultReason', str, 1200),

    /* --- links --- */
    productId: pick('productId', str, 80),
    manualId: pick('manualId', str, 80),
    notes: pick('notes', str, 2000),
  };
}

function validate(fields) {
  if (!fields.name) throw Object.assign(new Error('Uskuna nomi majburiy'), { status: 400 });
  if (!fields.model) throw Object.assign(new Error('Qurilma modeli majburiy'), { status: 400 });
  if (!fields.productionCountry) {
    throw Object.assign(new Error('Ishlab chiqarilgan mamlakat majburiy'), { status: 400 });
  }
  if (!fields.district) {
    throw Object.assign(new Error('Tuman/shahar tanlanishi shart'), { status: 400 });
  }
  if (fields.district === 'other' && !fields.districtOther) {
    throw Object.assign(new Error('Tumanni qo‘lda kiriting'), { status: 400 });
  }
  if (!fields.organization) {
    throw Object.assign(new Error('Tashkilot nomi majburiy'), { status: 400 });
  }
  if (STATUSES_NEEDING_REASON.includes(fields.status) && !fields.faultReason) {
    throw Object.assign(
      new Error('Nosoz/yaroqsiz uskuna uchun buzilish sababini yozing'),
      { status: 400 },
    );
  }
  const bytes = imagesBytes(fields.images);
  if (bytes > MAX_ASSET_IMAGE_BYTES) {
    throw Object.assign(
      new Error(`Rasmlar hajmi 50 MB dan oshmasligi kerak (hozir ${(bytes / 1048576).toFixed(1)} MB)`),
      { status: 413 },
    );
  }
}

/* ------------------------------------------------------------------ */
/* read                                                                */
/* ------------------------------------------------------------------ */

const districtName = (asset) =>
  asset.district === 'other'
    ? asset.districtOther
    : lookupDistrict(asset.region, asset.district, asset.districtOther);

/** an asset plus the human-readable names behind its stored ids */
export function decorate(asset) {
  const { group, section, item } = findClassification(
    asset.classGroup,
    asset.classSection,
    asset.classItem,
  );
  return {
    ...asset,
    classGroupName: group?.name || '',
    classSectionName: section?.name || '',
    classItemName: item?.name || '',
    classPath: [group?.name, section?.name, item?.name].filter(Boolean).join(' / '),
    regionName: lookupRegion(asset.region),
    districtName: districtName(asset),
    imagesBytes: imagesBytes(asset.images || []),
    warrantyActive: asset.warrantyUntil ? asset.warrantyUntil >= new Date().toISOString().slice(0, 10) : null,
  };
}

export function getAssets() {
  return (readDb().assets || []).map(decorate);
}

export function getAssetById(id) {
  const asset = (readDb().assets || []).find((a) => a.id === id);
  return asset ? decorate(asset) : null;
}

/* ------------------------------------------------------------------ */
/* change history (o‘zgarishlar tarixi)                                */
/*                                                                     */
/* Every edit is recorded field by field, so the panel can show who     */
/* changed what and when — including changes made from a printed QR.    */
/* ------------------------------------------------------------------ */

export const FIELD_LABELS = {
  classGroup: 'Klassifikatsiya',
  classSection: 'Bo‘lim',
  classItem: 'Punkt',
  images: 'Rasmlar',
  manufacturer: 'Ishlab chiqaruvchi kompaniya',
  manufacturerCountry: 'Firma mamlakati',
  productionCountry: 'Ishlab chiqarilgan mamlakat',
  name: 'Uskuna nomi',
  model: 'Qurilma modeli',
  serial: 'Seriya raqami',
  contractFile: 'Shartnoma fayli',
  invoiceFile: 'Hisob-faktura fayli',
  extraFiles: 'Qo‘shimcha fayllar',
  producedAt: 'Ishlab chiqarilgan sana',
  purchasedAt: 'Sotib olingan sana',
  warrantyUntil: 'Kafolat muddati',
  soldAt: 'Sotilgan sana',
  price: 'Uskuna narxi',
  region: 'Region',
  district: 'Tuman / shahar',
  districtOther: 'Tuman (qo‘lda)',
  organization: 'Tashkilot',
  organizationNote: 'Tashkilot izohi',
  lat: 'Geografik kenglik',
  lng: 'Geografik uzunlik',
  status: 'Holati',
  faultReason: 'Nosozlik sababi',
  productId: 'Katalogdagi apparat',
  manualId: 'Yo‘riqnoma',
  notes: 'Izohlar',
};

/** a readable one-line form of any stored value */
function describe(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return `${value.length} ta`;
  if (typeof value === 'object') return value.name || value.url || 'fayl';
  return String(value);
}

/** the fields that actually changed between two versions of a record */
function diffFields(before, after) {
  const changes = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a ?? '') === JSON.stringify(b ?? '')) continue;
    changes.push({
      field: key,
      label: FIELD_LABELS[key],
      from: describe(a),
      to: describe(b),
    });
  }
  return changes;
}

function pushHistory(asset, action, actor, changes = []) {
  asset.history ??= [];
  asset.history.unshift({
    id: `hst-${crypto.randomUUID().slice(0, 8)}`,
    action, // 'created' | 'updated' | 'status'
    actor: str(actor, 80) || '—',
    at: new Date().toISOString(),
    changes,
  });
  asset.history = asset.history.slice(0, 120);
}

export const getAssetHistory = (id) => getAssetById(id)?.history || [];

/* ------------------------------------------------------------------ */
/* write                                                               */
/* ------------------------------------------------------------------ */

export function createAsset(payload, author = '') {
  const db = readDb();
  const fields = normalise(payload);
  validate(fields);

  const now = new Date().toISOString();
  const asset = {
    id: `ast-${crypto.randomUUID().slice(0, 8)}`,
    ...fields,
    statusChangedAt: now,
    statusChangedBy: str(author, 80) || 'admin',
    createdBy: str(author, 80),
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  pushHistory(asset, 'created', author);
  db.assets = [asset, ...(db.assets || [])];
  writeDb(db);
  return decorate(asset);
}

export function updateAsset(id, payload, author = '') {
  const db = readDb();
  const asset = (db.assets || []).find((a) => a.id === id);
  if (!asset) throw Object.assign(new Error('Uskuna topilmadi'), { status: 404 });

  const previousStatus = asset.status;
  const before = { ...asset };
  const fields = normalise(payload, asset);
  validate(fields);

  Object.assign(asset, fields);
  asset.updatedAt = new Date().toISOString();

  const changes = diffFields(before, asset);
  if (changes.length) pushHistory(asset, 'updated', author, changes);

  if (previousStatus !== asset.status) {
    asset.statusChangedAt = asset.updatedAt;
    asset.statusChangedBy = str(author, 80) || 'admin';
    pushNotification(db, asset, previousStatus, asset.status, asset.faultReason, asset.statusChangedBy);
  }
  writeDb(db);
  return decorate(asset);
}

export function deleteAsset(id) {
  const db = readDb();
  if (!(db.assets || []).some((a) => a.id === id)) {
    throw Object.assign(new Error('Uskuna topilmadi'), { status: 404 });
  }
  db.assets = db.assets.filter((a) => a.id !== id);
  writeDb(db);
  return { ok: true };
}

/**
 * The condition change a visitor makes from the printed QR page.
 * No authentication — the QR code itself is the key — but every change is
 * announced to the administrators.
 */
export function setAssetStatus(id, status, reason, actor = 'QR foydalanuvchi') {
  if (!STATUS_IDS.includes(status)) {
    throw Object.assign(new Error('Noma’lum holat'), { status: 400 });
  }
  const db = readDb();
  const asset = (db.assets || []).find((a) => a.id === id);
  if (!asset) throw Object.assign(new Error('Uskuna topilmadi'), { status: 404 });

  const cleanReason = str(reason, 1200);
  if (STATUSES_NEEDING_REASON.includes(status) && !cleanReason) {
    throw Object.assign(new Error('Buzilish sababini yozing'), { status: 400 });
  }

  const previous = asset.status;
  if (previous === status && cleanReason === (asset.faultReason || '')) {
    return decorate(asset);
  }

  asset.status = status;
  asset.faultReason = status === 'soz' ? '' : cleanReason;
  asset.statusChangedAt = new Date().toISOString();
  asset.statusChangedBy = str(actor, 80);
  asset.updatedAt = asset.statusChangedAt;
  pushHistory(asset, 'status', actor, [
    { field: 'status', label: FIELD_LABELS.status, from: previous, to: status },
    ...(cleanReason
      ? [{ field: 'faultReason', label: FIELD_LABELS.faultReason, from: '—', to: cleanReason }]
      : []),
  ]);
  pushNotification(db, asset, previous, status, asset.faultReason, asset.statusChangedBy);
  writeDb(db);
  return decorate(asset);
}

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */

function pushNotification(db, asset, from, to, reason, actor) {
  db.notifications ??= [];
  db.notifications.unshift({
    id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
    type: 'status',
    assetId: asset.id,
    assetName: asset.name,
    assetModel: asset.model,
    serial: asset.serial,
    organization: asset.organization,
    district: districtName(asset),
    from,
    to,
    reason: reason || '',
    actor: actor || '',
    at: new Date().toISOString(),
    readBy: [],
  });
  db.notifications = db.notifications.slice(0, 300);
}

export function getNotifications(userId, limit = 40) {
  const list = (readDb().notifications || []).slice(0, limit);
  return {
    items: list.map((n) => ({ ...n, read: (n.readBy || []).includes(userId) })),
    unread: list.filter((n) => !(n.readBy || []).includes(userId)).length,
  };
}

export function markNotificationsRead(userId, ids) {
  const db = readDb();
  const wanted = Array.isArray(ids) && ids.length ? new Set(ids) : null;
  for (const notification of db.notifications || []) {
    if (wanted && !wanted.has(notification.id)) continue;
    notification.readBy ??= [];
    if (!notification.readBy.includes(userId)) notification.readBy.push(userId);
  }
  writeDb(db);
  return getNotifications(userId);
}

/* ------------------------------------------------------------------ */
/* the public view behind a QR code                                    */
/* ------------------------------------------------------------------ */

/**
 * What a visitor who scanned the printed QR code is allowed to see:
 * the photograph, the name, the model, the serial number and the condition —
 * nothing about price, contracts or purchase history.
 */
export function publicAsset(asset) {
  if (!asset) return null;
  const full = decorate(asset);
  return {
    id: full.id,
    name: full.name,
    model: full.model,
    serial: full.serial,
    image: full.images?.[0]?.url || null,
    images: (full.images || []).map((i) => i.url),
    status: full.status,
    faultReason: full.faultReason || '',
    statusChangedAt: full.statusChangedAt || null,
    organization: full.organization,
    districtName: full.districtName,
    classItemName: full.classItemName,
    manualId: full.manualId || null,
  };
}

/* ------------------------------------------------------------------ */
/* organisations                                                       */
/*                                                                     */
/* The list is built from what has already been entered, so the form    */
/* can offer a dropdown while still accepting a name nobody has typed   */
/* before.                                                             */
/* ------------------------------------------------------------------ */

export function getOrganizations({ region, district } = {}) {
  const seen = new Map();
  for (const asset of readDb().assets || []) {
    if (!asset.organization) continue;
    if (region && region !== 'all' && asset.region !== region) continue;
    if (district && district !== 'all' && asset.district !== district) continue;
    const key = asset.organization.trim();
    const entry = seen.get(key) || { name: key, count: 0, region: asset.region, district: asset.district };
    entry.count += 1;
    seen.set(key, entry);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'uz'));
}

/* ------------------------------------------------------------------ */
/* filtering + dashboard aggregation                                   */
/* ------------------------------------------------------------------ */

const has = (value) => value && value !== 'all';

/** the filter set shared by the list page, the dashboard and the export */
export function filterAssets(assets, query = {}) {
  const needle = String(query.q || '').trim().toLowerCase();
  return assets.filter((a) => {
    if (has(query.region) && a.region !== query.region) return false;
    if (has(query.district) && a.district !== query.district) return false;
    if (has(query.organization) && a.organization !== query.organization) return false;
    if (has(query.classGroup) && a.classGroup !== query.classGroup) return false;
    if (has(query.classSection) && a.classSection !== query.classSection) return false;
    if (has(query.classItem) && a.classItem !== query.classItem) return false;
    if (has(query.status) && a.status !== query.status) return false;
    if (query.serial && !String(a.serial || '').toLowerCase().includes(String(query.serial).toLowerCase())) {
      return false;
    }
    if (
      query.manufacturerCountry &&
      !String(a.manufacturerCountry || '')
        .toLowerCase()
        .includes(String(query.manufacturerCountry).toLowerCase())
    ) {
      return false;
    }
    if (query.producedAt && a.producedAt !== query.producedAt) return false;
    if (needle) {
      const hay = [
        a.name,
        a.model,
        a.serial,
        a.organization,
        a.districtName,
        a.regionName,
        a.classItemName,
        a.manufacturer,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

const tally = (list) => ({
  total: list.length,
  soz: list.filter((a) => a.status === 'soz').length,
  nosoz: list.filter((a) => a.status === 'nosoz').length,
  yaroqsiz: list.filter((a) => a.status === 'yaroqsiz').length,
});

/** everything the monitoring dashboard draws */
export function dashboardStats(query = {}) {
  const all = getAssets();
  const list = filterAssets(all, query);

  const byRegion = new Map();
  for (const asset of list) {
    const key = asset.region || 'other';
    const entry = byRegion.get(key) || { id: key, name: asset.regionName || '—', items: [] };
    entry.items.push(asset);
    byRegion.set(key, entry);
  }

  const byClass = new Map();
  for (const asset of list) {
    const key = asset.classGroup || 'other';
    const entry = byClass.get(key) || { id: key, name: asset.classGroupName || '—', items: [] };
    entry.items.push(asset);
    byClass.set(key, entry);
  }

  return {
    totals: tally(list),
    byRegion: [...byRegion.values()]
      .map((r) => ({ id: r.id, name: r.name, ...tally(r.items) }))
      .sort((a, b) => b.total - a.total),
    byClass: [...byClass.values()]
      .map((c) => ({ id: c.id, name: c.name, ...tally(c.items) }))
      .sort((a, b) => b.total - a.total),
    /* only what the map needs — the table fetches full records separately */
    points: list
      .filter((a) => a.lat !== null && a.lng !== null)
      .slice(0, 2000)
      .map((a) => ({
        id: a.id,
        name: a.name,
        model: a.model,
        status: a.status,
        organization: a.organization,
        districtName: a.districtName,
        lat: a.lat,
        lng: a.lng,
      })),
  };
}

/* ------------------------------------------------------------------ */
/* excel                                                               */
/* ------------------------------------------------------------------ */

export const ASSET_EXPORT_COLUMNS = [
  { key: 'no', label: '№', width: 6 },
  { key: 'name', label: 'Uskuna nomi', width: 34 },
  { key: 'model', label: 'Qurilma modeli', width: 22 },
  { key: 'serial', label: 'Seriya raqami', width: 22 },
  { key: 'classGroupName', label: 'Klassifikatsiya — yo‘nalish', width: 32 },
  { key: 'classSectionName', label: 'Klassifikatsiya — bo‘lim', width: 34 },
  { key: 'classItemName', label: 'Klassifikatsiya — punkt', width: 38 },
  { key: 'statusName', label: 'Holati', width: 12 },
  { key: 'faultReason', label: 'Nosozlik sababi', width: 40 },
  { key: 'manufacturer', label: 'Ishlab chiqaruvchi', width: 26 },
  { key: 'manufacturerCountry', label: 'Firma mamlakati', width: 18 },
  { key: 'productionCountry', label: 'Ishlab chiqarilgan mamlakat', width: 24 },
  { key: 'producedAt', label: 'Ishlab chiqarilgan sana', width: 18 },
  { key: 'purchasedAt', label: 'Sotib olingan sana', width: 18 },
  { key: 'warrantyUntil', label: 'Kafolat muddati', width: 18 },
  { key: 'soldAt', label: 'Sotilgan sana', width: 16 },
  { key: 'price', label: 'Uskuna narxi', width: 16 },
  { key: 'regionName', label: 'Region', width: 24 },
  { key: 'districtName', label: 'Tuman / shahar', width: 22 },
  { key: 'organization', label: 'Tashkilot', width: 34 },
  { key: 'updatedAt', label: 'Yangilangan', width: 20 },
];

const STATUS_NAMES = { soz: 'Soz', nosoz: 'Nosoz', yaroqsiz: 'Yaroqsiz' };

export const assetExportRows = (assets) =>
  assets.map((a, i) => ({
    ...a,
    no: i + 1,
    statusName: STATUS_NAMES[a.status] || a.status,
    updatedAt: (a.updatedAt || '').slice(0, 16).replace('T', ' '),
  }));
