import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  categoriesWithCounts,
  featuredProducts,
  getManuals,
  getManualById,
  getManualForProduct,
  createManual,
  updateManual,
  deleteManual,
  getContacts,
  updateContacts,
} from './store.js';
import {
  readDb,
  writeDb,
  initDb,
  hashPassword,
  verifyPassword,
  dummyVerify,
  publicUser,
  logActivity,
  generatedPasswords,
  getStorage,
  closeDb,
  DATA_DIR,
  UPLOAD_DIR,
} from './db.js';
import {
  getAssets,
  getAssetById,
  getAssetHistory,
  createAsset,
  updateAsset,
  deleteAsset,
  setAssetStatus,
  publicAsset,
  getNotifications,
  markNotificationsRead,
  getOrganizations,
  filterAssets,
  dashboardStats,
  ASSET_EXPORT_COLUMNS,
  assetExportRows,
  MAX_ASSET_IMAGE_BYTES,
} from './assets.js';
import { CLASSIFICATION, classificationRows } from './data/classification.js';
import { referencePayload } from './data/reference.js';
import { REGIONS, regionRows } from './data/regions.js';
import { buildWorkbook } from './xlsx.js';
import {
  applyBaseSecurity,
  resolveJwtSecret,
  jsonParser,
  apiLimiter,
  loginLimiter,
  qrLimiter,
  uploadLimiter,
  integrationLimiter,
  inquiryLimiter,
  looksLikeImage,
  lockoutRemaining,
  recordLoginFailure,
  clearLoginFailures,
  checkPasswordStrength,
  isProduction,
} from './security.js';
import {
  SCOPES,
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  requireApiKey,
} from './integration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5175;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = resolveJwtSecret();
const TOKEN_TTL = process.env.TOKEN_TTL || '12h';
const JWT_ISSUER = 'gold-med-nova';

const app = express();

applyBaseSecurity(app);
app.use('/api', apiLimiter);
// small by default — the two upload routes raise their own ceiling
app.use(jsonParser('256kb'));

/**
 * Uploaded files carry a generated UUID name, so nothing a caller sends can
 * steer the path. They are served as attachments-in-place with sniffing
 * disabled, and never executed.
 *
 * Which route answers depends on the backend: express.static off the disk,
 * or a lookup in Postgres. Both answer at the same /uploads/<name> address,
 * so the URLs already stored in the database keep working either way.
 */
const UPLOAD_NAME = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i;

app.get('/uploads/:name', async (req, res, next) => {
  const store = getStorage();
  if (!store || store.kind !== 'postgres') return next();

  const { name } = req.params;
  if (!UPLOAD_NAME.test(name)) return res.status(404).end();

  try {
    const file = await store.getFile(name);
    if (!file) return res.status(404).end();
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(file.buffer);
  } catch (err) {
    return next(err);
  }
});

app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    maxAge: '7d',
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    },
  }),
);

/* ------------------------------------------------------------------ */
/* company / contact details                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* auth helpers                                                       */
/* ------------------------------------------------------------------ */

/** first 16 hex characters of the stored hash — changes when the password does */
const passwordStamp = (user) =>
  crypto.createHash('sha256').update(String(user.password || '')).digest('hex').slice(0, 16);

function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, pwd: passwordStamp(user) },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_ISSUER },
  );
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      // algorithms is pinned so a forged token cannot pick a weaker one
      const payload = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_ISSUER,
      });
      const user = readDb().users.find((u) => u.id === payload.sub);
      if (!user || user.status === 'suspended') {
        return res.status(401).json({ error: 'Session is no longer valid' });
      }
      // a password change retires every token minted before it
      if (payload.pwd !== passwordStamp(user)) {
        return res.status(401).json({ error: 'Parol o‘zgardi — qaytadan kiring' });
      }
      // the role in the token is only a hint; the stored role is the truth
      req.user = user;
      return next();
    } catch {
      if (!required) return next();
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }
  };
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission for this action' });
  }
  return next();
};

/** turns a thrown store error into the right status code */
const handle = (res, fn) => {
  try {
    return res.json(fn());
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unexpected error' });
  }
};

/* ------------------------------------------------------------------ */
/* public routes                                                      */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'gold-med-nova', time: new Date().toISOString() }),
);

app.get('/api/contacts', (_req, res) => res.json(getContacts()));

/** classification tree, regions, statuses and the standard spec sheet */
app.get('/api/reference', (_req, res) => res.json(referencePayload(CLASSIFICATION, REGIONS)));

app.get('/api/categories', (_req, res) => res.json(categoriesWithCounts()));

app.get('/api/products', (req, res) => {
  const { category, q, sub, limit } = req.query;
  let list = getProducts();
  if (category && category !== 'all') list = list.filter((p) => p.category === category);
  if (sub) list = list.filter((p) => p.subcategory === sub);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((p) =>
      [p.model, p.name, p.subcategory, p.summary].join(' ').toLowerCase().includes(needle),
    );
  }
  const total = list.length;
  if (limit) list = list.slice(0, Number(limit));
  res.json({ total, items: list });
});

app.get('/api/products/featured', (_req, res) => res.json(featuredProducts()));

app.get('/api/products/:id', (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const related = getProducts()
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 6);
  const category = getCategoryById(product.category);
  const manual = getManualForProduct(product.id);
  res.json({
    ...product,
    related,
    categoryName: category?.name || product.category,
    manual: manual
      ? { id: manual.id, title: manual.title, contactName: manual.contactName, contactPhone: manual.contactPhone }
      : null,
  });
});

// Manuals are not listed publicly — only fetched one at a time by their id,
// which is what the printed QR code encodes.
app.get('/api/manuals/:id', (req, res) => {
  const manual = getManualById(req.params.id);
  if (!manual) return res.status(404).json({ error: 'Manual not found' });
  const devices = getProducts()
    .filter((p) => manual.productIds.includes(p.id))
    .map((p) => ({ id: p.id, model: p.model, name: p.name, image: p.image }));
  res.json({ ...manual, devices });
});

/* ------------------------------------------------------------------ */
/* the printed QR code                                                */
/*                                                                    */
/* Scanning the label opens /q/:assetId, which offers three things:    */
/* how to use the machine, what the machine is, and who to call. The   */
/* visitor may change the condition — every change wakes the panel.    */
/* ------------------------------------------------------------------ */

app.get('/api/qr/:assetId', (req, res) => {
  const asset = getAssetById(req.params.assetId);
  if (!asset) return res.status(404).json({ error: 'Uskuna topilmadi' });

  const view = publicAsset(asset);
  const manual = asset.manualId ? getManualById(asset.manualId) : null;
  const product = asset.productId ? getProductById(asset.productId) : null;
  res.json({
    ...view,
    image: view.image || product?.image || null,
    manual: manual ? { id: manual.id, title: manual.title } : null,
    contacts: getContacts(),
  });
});

app.patch('/api/qr/:assetId/status', qrLimiter, (req, res) =>
  handle(res, () => {
    const { status, reason, actor } = req.body || {};
    const saved = setAssetStatus(req.params.assetId, status, reason, actor || 'QR foydalanuvchi');
    logActivity('asset', actor || 'QR', `${saved.model} holati “${saved.status}” ga o‘zgartirildi`);
    return publicAsset(saved);
  }),
);

app.post('/api/inquiries', inquiryLimiter, (req, res) => {
  const { productId, contactName, phone, email, message, quantity } = req.body || {};
  if (!contactName || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required' });
  }
  const product = productId ? getProductById(productId) : null;
  const db = readDb();
  const inquiry = {
    id: `inq-${crypto.randomUUID().slice(0, 8)}`,
    productId: product?.id || null,
    productModel: product?.model || null,
    productName: product?.name || null,
    category: product?.category || null,
    contactName: String(contactName).slice(0, 120),
    region: String(req.body.region || '').slice(0, 80),
    phone: String(phone).slice(0, 40),
    email: String(email || '').slice(0, 120),
    quantity: Number(quantity) > 0 ? Number(quantity) : 1,
    message: String(message || '').slice(0, 1200),
    status: 'new',
    assignedTo: null,
    createdAt: new Date().toISOString(),
  };
  db.inquiries.unshift(inquiry);
  writeDb(db);
  logActivity('inquiry', inquiry.contactName, `New request for ${inquiry.productModel || 'general enquiry'}`);
  res.status(201).json(inquiry);
});

/* ------------------------------------------------------------------ */
/* auth routes                                                        */
/* ------------------------------------------------------------------ */

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // six wrong guesses lock that username from that address for fifteen minutes
  const wait = lockoutRemaining(req.ip, username);
  if (wait) {
    return res.status(429).json({
      error: `Juda ko‘p noto‘g‘ri urinish. ${Math.ceil(wait / 60)} daqiqadan keyin urinib ko‘ring.`,
    });
  }

  const needle = String(username).trim().toLowerCase();
  const user = readDb().users.find(
    (u) =>
      String(u.username || '').toLowerCase() === needle ||
      String(u.email || '').toLowerCase() === needle,
  );

  // An unknown username burns the same CPU as a real check, so the reply time
  // cannot be used to tell which accounts exist. An account seeded without a
  // credential (password: null) can never pass this.
  const ok = user && user.password
    ? await verifyPassword(password, user.password)
    : await dummyVerify();

  if (!ok) {
    recordLoginFailure(req.ip, username);
    // the same message either way, so the response cannot enumerate accounts
    return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended' });
  }
  clearLoginFailures(req.ip, username);
  const db = readDb();
  user.status = user.status === 'invited' ? 'active' : user.status;
  user.lastActive = new Date().toISOString();
  writeDb(db);
  logActivity('login', user.name, `${user.name} signed in`);
  res.json({
    token: sign(user),
    user: publicUser(user),
    mustChangePassword: Boolean(user.mustChangePassword),
  });
});

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/password', auth(), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!(await verifyPassword(currentPassword, req.user.password))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const weak = checkPasswordStrength(newPassword, req.user.username);
  if (weak) return res.status(400).json({ error: weak });
  const db = readDb();
  req.user.password = await hashPassword(newPassword);
  req.user.mustChangePassword = false;
  req.user.passwordChangedAt = new Date().toISOString();
  writeDb(db);
  logActivity('user', req.user.name, `${req.user.name} parolini o‘zgartirdi`);
  // the caller's old token no longer verifies, so hand back a fresh one
  res.json({ ok: true, token: sign(req.user) });
});

/* ------------------------------------------------------------------ */
/* admin — dashboard                                                  */
/* ------------------------------------------------------------------ */

app.get('/api/admin/stats', auth(), (req, res) => {
  const db = readDb();
  const products = getProducts();
  const cats = categoriesWithCounts();
  const byCategory = cats.map((c) => ({
    id: c.id,
    name: c.name,
    accent: c.accent,
    custom: c.custom,
    products: c.count,
    inquiries: db.inquiries.filter((i) => i.category === c.id).length,
  }));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      label: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      value: db.inquiries.filter((inq) => {
        const at = new Date(inq.createdAt);
        return at >= day && at < next;
      }).length,
    };
  });
  res.json({
    totals: {
      products: products.length,
      customProducts: products.filter((p) => p.custom).length,
      categories: cats.length,
      customCategories: cats.filter((c) => c.custom).length,
      users: db.users.length,
      admins: db.users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length,
      managers: db.users.filter((u) => u.role === 'manager').length,
      inquiries: db.inquiries.length,
      newInquiries: db.inquiries.filter((i) => i.status === 'new').length,
    },
    byCategory,
    week,
    activity: db.activity.slice(0, 12),
    recentInquiries: db.inquiries.slice(0, 8),
  });
});

/* ------------------------------------------------------------------ */
/* admin — users                                                      */
/* ------------------------------------------------------------------ */

// the team list carries colleagues' e-mail addresses and phone numbers,
// so a viewer or manager account has no business reading it
app.get('/api/admin/users', auth(), requireRole('superadmin', 'admin'), (req, res) => {
  res.json(readDb().users.map(publicUser));
});

app.post('/api/admin/users', auth(), requireRole('superadmin'), async (req, res) => {
  const { name, username, email, phone, role = 'admin', password, organization } = req.body || {};
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email and password are required' });
  }
  const weakPassword = checkPasswordStrength(password, username);
  if (weakPassword) return res.status(400).json({ error: weakPassword });
  if (!['admin', 'manager', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, manager or viewer' });
  }
  const db = readDb();
  const taken = db.users.some(
    (u) =>
      u.username.toLowerCase() === String(username).toLowerCase() ||
      u.email.toLowerCase() === String(email).toLowerCase(),
  );
  if (taken) return res.status(409).json({ error: 'That username or email is already in use' });

  const user = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    name: String(name).slice(0, 80),
    username: String(username).trim().slice(0, 40),
    email: String(email).trim().slice(0, 120),
    phone: String(phone || '').slice(0, 40),
    role,
    status: 'active',
    organization: String(organization || 'Gold Med Nova').slice(0, 80),
    twoFactor: false,
    createdAt: new Date().toISOString(),
    lastActive: null,
    mustChangePassword: false,
    passwordChangedAt: new Date().toISOString(),
    password: await hashPassword(password),
  };
  db.users.push(user);
  writeDb(db);
  logActivity('user', req.user.name, `${req.user.name} appointed ${user.name} as ${role}`);
  res.status(201).json(publicUser(user));
});

app.patch('/api/admin/users/:id', auth(), requireRole('superadmin'), async (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'superadmin' && req.body.role && req.body.role !== 'superadmin') {
    return res.status(400).json({ error: 'The super admin role cannot be changed' });
  }
  const patch = req.body || {};
  for (const key of ['name', 'email', 'phone', 'organization']) {
    if (patch[key] !== undefined) user[key] = String(patch[key]).slice(0, 120);
  }
  if (patch.role && ['admin', 'manager', 'viewer'].includes(patch.role)) user.role = patch.role;
  if (patch.status && ['active', 'invited', 'suspended'].includes(patch.status)) {
    user.status = patch.status;
  }
  if (patch.twoFactor !== undefined) user.twoFactor = Boolean(patch.twoFactor);
  if (patch.password) {
    const weak = checkPasswordStrength(patch.password, user.username);
    if (weak) return res.status(400).json({ error: weak });
    user.password = await hashPassword(patch.password);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date().toISOString();
  }
  writeDb(db);
  logActivity('user', req.user.name, `${req.user.name} updated ${user.name}`);
  res.json(publicUser(user));
});

app.delete('/api/admin/users/:id', auth(), requireRole('superadmin'), (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'superadmin') {
    return res.status(400).json({ error: 'The super admin account cannot be removed' });
  }
  db.users = db.users.filter((u) => u.id !== req.params.id);
  writeDb(db);
  logActivity('user', req.user.name, `${req.user.name} removed ${user.name}`);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* admin — inquiries                                                  */
/* ------------------------------------------------------------------ */

app.get('/api/admin/inquiries', auth(), (req, res) => {
  const { status } = req.query;
  let list = readDb().inquiries;
  if (status && status !== 'all') list = list.filter((i) => i.status === status);
  res.json(list);
});

app.patch('/api/admin/inquiries/:id', auth(), requireRole('superadmin', 'admin'), (req, res) => {
  const db = readDb();
  const inquiry = db.inquiries.find((i) => i.id === req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Request not found' });
  const { status, assignedTo } = req.body || {};
  if (status && ['new', 'contacted', 'quoted', 'won', 'lost'].includes(status)) {
    inquiry.status = status;
  }
  if (assignedTo !== undefined) inquiry.assignedTo = assignedTo || null;
  writeDb(db);
  res.json(inquiry);
});

/* ------------------------------------------------------------------ */
/* admin — catalogues                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/admin/categories', auth(), (_req, res) => res.json(categoriesWithCounts()));

app.post('/api/admin/categories', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const created = createCategory(req.body || {});
    logActivity('catalogue', req.user.name, `${req.user.name} created catalogue “${created.name}”`);
    return created;
  }),
);

app.patch('/api/admin/categories/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => updateCategory(req.params.id, req.body || {})),
);

app.delete('/api/admin/categories/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const result = deleteCategory(req.params.id);
    logActivity('catalogue', req.user.name, `${req.user.name} removed a catalogue`);
    return result;
  }),
);

/* ------------------------------------------------------------------ */
/* admin — products                                                   */
/* ------------------------------------------------------------------ */

app.get('/api/admin/products', auth(), (_req, res) => {
  const db = readDb();
  res.json(
    getProducts().map((p) => ({
      ...p,
      inquiries: db.inquiries.filter((i) => i.productId === p.id).length,
    })),
  );
});

app.post('/api/admin/products', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const created = createProduct(req.body || {});
    logActivity('product', req.user.name, `${req.user.name} added ${created.model}`);
    return created;
  }),
);

app.patch('/api/admin/products/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => updateProduct(req.params.id, req.body || {})),
);

app.delete('/api/admin/products/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const result = deleteProduct(req.params.id);
    logActivity('product', req.user.name, `${req.user.name} removed a device`);
    return result;
  }),
);

/* ------------------------------------------------------------------ */
/* admin — service manuals                                            */
/* ------------------------------------------------------------------ */

app.get('/api/admin/manuals', auth(), (_req, res) => {
  const products = getProducts();
  res.json(
    getManuals().map((m) => ({
      ...m,
      devices: products
        .filter((p) => m.productIds.includes(p.id))
        .map((p) => ({ id: p.id, model: p.model, name: p.name, image: p.image })),
    })),
  );
});

app.get('/api/admin/manuals/:id', auth(), (req, res) => {
  const manual = getManualById(req.params.id);
  if (!manual) return res.status(404).json({ error: 'Manual not found' });
  res.json(manual);
});

app.post('/api/admin/manuals', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const created = createManual(req.body || {}, req.user.name);
    logActivity('manual', req.user.name, `${req.user.name} wrote the manual “${created.title}”`);
    return created;
  }),
);

app.patch('/api/admin/manuals/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const saved = updateManual(req.params.id, req.body || {});
    logActivity('manual', req.user.name, `${req.user.name} updated the manual “${saved.title}”`);
    return saved;
  }),
);

app.delete('/api/admin/manuals/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const result = deleteManual(req.params.id);
    logActivity('manual', req.user.name, `${req.user.name} removed a manual`);
    return result;
  }),
);

/* ------------------------------------------------------------------ */
/* admin — contact page content                                       */
/* ------------------------------------------------------------------ */

app.put('/api/admin/contacts', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const saved = updateContacts(req.body || {});
    logActivity('contact', req.user.name, `${req.user.name} edited the contact page`);
    return saved;
  }),
);

/* ------------------------------------------------------------------ */
/* admin — apparat monitoringi (the fleet register)                   */
/* ------------------------------------------------------------------ */

/**
 * The register. Every filter on the list page is a query parameter, so the
 * same endpoint serves the table, the dashboard and the export.
 */
app.get('/api/admin/assets', auth(), (req, res) => {
  const all = getAssets();
  const list = filterAssets(all, req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(req.query.perPage) || 20));
  res.json({
    total: list.length,
    grandTotal: all.length,
    page,
    perPage,
    items: list.slice((page - 1) * perPage, page * perPage),
  });
});

/** the dashboard: totals, per-region and per-field breakdowns, map points */
app.get('/api/admin/dashboard', auth(), (req, res) => res.json(dashboardStats(req.query)));

/** organisation names already in use, for the combo box on the form */
app.get('/api/admin/organizations', auth(), (req, res) =>
  res.json(getOrganizations({ region: req.query.region, district: req.query.district })),
);

/** the whole register as a real .xlsx workbook — must sit before /:id */
app.get('/api/admin/assets/export.xlsx', auth(), requireRole('superadmin', 'admin'), (req, res) => {
  // the workbook follows whatever the list page is currently filtered to
  const assets = filterAssets(getAssets(), req.query);
  const summary = dashboardStats(req.query);
  const workbook = buildWorkbook([
    {
      name: 'Apparat monitoringi',
      columns: ASSET_EXPORT_COLUMNS,
      rows: assetExportRows(assets),
    },
    {
      name: 'Hududlar kesimida',
      columns: [
        { key: 'name', label: 'Region', width: 32 },
        { key: 'total', label: 'Jami', width: 12 },
        { key: 'soz', label: 'Soz', width: 12 },
        { key: 'nosoz', label: 'Nosoz', width: 12 },
        { key: 'yaroqsiz', label: 'Yaroqsiz', width: 14 },
      ],
      rows: summary.byRegion,
    },
    {
      name: 'Yo‘nalishlar kesimida',
      columns: [
        { key: 'name', label: 'Yo‘nalish', width: 40 },
        { key: 'total', label: 'Jami', width: 12 },
        { key: 'soz', label: 'Soz', width: 12 },
        { key: 'nosoz', label: 'Nosoz', width: 12 },
        { key: 'yaroqsiz', label: 'Yaroqsiz', width: 14 },
      ],
      rows: summary.byClass,
    },
    {
      name: 'Klassifikatsiya',
      columns: [
        { key: 'no', label: '№', width: 9 },
        { key: 'groupName', label: '1 — Yo‘nalish', width: 36 },
        { key: 'sectionName', label: '2 — Bo‘lim', width: 40 },
        { key: 'itemName', label: '3 — Punkt', width: 46 },
        { key: 'itemId', label: 'Kod', width: 50 },
      ],
      rows: classificationRows(),
    },
    {
      name: 'Hududlar',
      columns: [
        { key: 'no', label: '№', width: 9 },
        { key: 'regionName', label: 'Region', width: 32 },
        { key: 'districtName', label: 'Tuman / shahar', width: 32 },
        { key: 'type', label: 'Turi', width: 12 },
        { key: 'districtId', label: 'Kod', width: 34 },
      ],
      rows: regionRows(),
    },
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="apparat-monitoringi-${stamp}.xlsx"`);
  res.send(workbook);
});

/** the classification tree on its own */
app.get('/api/admin/classification.xlsx', auth(), requireRole('superadmin', 'admin'), (_req, res) => {
  const workbook = buildWorkbook([
    {
      name: 'Klassifikatsiya',
      columns: [
        { key: 'no', label: '№', width: 9 },
        { key: 'groupName', label: '1 — Yo‘nalish', width: 36 },
        { key: 'sectionName', label: '2 — Bo‘lim', width: 40 },
        { key: 'itemName', label: '3 — Punkt', width: 46 },
        { key: 'itemId', label: 'Kod', width: 50 },
      ],
      rows: classificationRows(),
    },
    {
      name: 'Yo‘nalishlar',
      columns: [
        { key: 'name', label: 'Yo‘nalish', width: 40 },
        { key: 'sections', label: 'Bo‘limlar', width: 14 },
        { key: 'items', label: 'Punktlar', width: 14 },
      ],
      rows: CLASSIFICATION.map((g) => ({
        name: g.name,
        sections: g.sections.length,
        items: g.sections.reduce((sum, s) => sum + s.items.length, 0),
      })),
    },
  ]);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="klassifikatsiya.xlsx"');
  res.send(workbook);
});

/** who changed what, and when */
app.get('/api/admin/assets/:id/history', auth(), (req, res) => {
  const asset = getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Uskuna topilmadi' });
  res.json({ id: asset.id, model: asset.model, name: asset.name, history: getAssetHistory(asset.id) });
});

/** one full record */
app.get('/api/admin/assets/:id', auth(), (req, res) => {
  const asset = getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Uskuna topilmadi' });
  res.json(asset);
});

app.post('/api/admin/assets', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const created = createAsset(req.body || {}, req.user.name);
    logActivity('asset', req.user.name, `${req.user.name} “${created.model}” uskunasini qo‘shdi`);
    return created;
  }),
);

app.patch('/api/admin/assets/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => updateAsset(req.params.id, req.body || {}, req.user.name)),
);

app.delete('/api/admin/assets/:id', auth(), requireRole('superadmin', 'admin'), (req, res) =>
  handle(res, () => {
    const result = deleteAsset(req.params.id);
    logActivity('asset', req.user.name, `${req.user.name} bitta uskunani ro‘yxatdan o‘chirdi`);
    return result;
  }),
);

/* ------------------------------------------------------------------ */
/* admin — notifications                                              */
/* ------------------------------------------------------------------ */

app.get('/api/admin/notifications', auth(), (req, res) =>
  res.json(getNotifications(req.user.id, Number(req.query.limit) || 40)),
);

app.post('/api/admin/notifications/read', auth(), (req, res) =>
  res.json(markNotificationsRead(req.user.id, req.body?.ids)),
);

/* ------------------------------------------------------------------ */
/* admin — image uploads                                              */
/* ------------------------------------------------------------------ */

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

app.post(
  '/api/admin/uploads',
  uploadLimiter,
  auth(),
  requireRole('superadmin', 'admin'),
  jsonParser('9mb'),
  async (req, res) => {
  const { dataUrl } = req.body || {};
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!match) return res.status(400).json({ error: 'Send the image as a base64 data URL' });

  const ext = MIME_EXT[match[1].toLowerCase()];
  if (!ext) return res.status(400).json({ error: 'Use a JPEG, PNG, WebP or AVIF image' });

  const buffer = Buffer.from(match[2], 'base64');
  const imageCap = Math.min(6 * 1024 * 1024, getStorage().maxFileBytes);
  if (buffer.length > imageCap) {
    return res.status(413).json({
      error: `Rasm ${Math.floor(imageCap / (1024 * 1024))} MB dan katta bo‘lmasligi kerak`,
    });
  }

  // the declared MIME type is the caller's word; the first bytes are proof
  if (!looksLikeImage(buffer)) {
    return res.status(400).json({ error: 'Bu fayl haqiqiy rasm emas' });
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  try {
    await getStorage().putFile(filename, buffer, match[1].toLowerCase());
  } catch (err) {
    console.error('[uploads]', err);
    return res.status(500).json({ error: 'Rasmni saqlab bo‘lmadi' });
  }
  res.status(201).json({ url: `/uploads/${filename}`, bytes: buffer.length });
  },
);

/* ------------------------------------------------------------------ */
/* admin — binary uploads (asset photos, contracts, invoices)         */
/*                                                                    */
/* Photographs may run to 50 MB per asset and contracts are PDFs, so   */
/* these arrive as raw bytes rather than base64 — a third smaller and  */
/* far easier on memory than a data URL.                               */
/* ------------------------------------------------------------------ */

const UPLOAD_EXT = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'heic'],
  doc: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'zip', 'rar', '7z'],
};

const EXT_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
};

app.post(
  '/api/admin/files',
  uploadLimiter,
  auth(),
  requireRole('superadmin', 'admin'),
  express.raw({ type: () => true, limit: '55mb' }),
  async (req, res) => {
    const kind = req.query.kind === 'doc' ? 'doc' : 'image';
    const original = String(req.query.name || 'fayl').slice(0, 160);
    const ext = (original.split('.').pop() || '').toLowerCase();

    if (!UPLOAD_EXT[kind].includes(ext)) {
      return res.status(400).json({
        error: `Bu fayl turi qabul qilinmaydi (.${ext}). Ruxsat: ${UPLOAD_EXT[kind].join(', ')}`,
      });
    }
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buffer.length) return res.status(400).json({ error: 'Bo‘sh fayl yuborildi' });

    // the ceiling is whatever the backend can take: a mounted disk swallows
    // 50 MB happily, a row in a free Postgres plan should not
    const cap = Math.min(MAX_ASSET_IMAGE_BYTES, getStorage().maxFileBytes);
    if (buffer.length > cap) {
      return res.status(413).json({
        error: `Fayl ${Math.floor(cap / (1024 * 1024))} MB dan katta bo‘lmasligi kerak`,
      });
    }
    if (kind === 'image' && !looksLikeImage(buffer)) {
      return res.status(400).json({ error: 'Bu fayl haqiqiy rasm emas' });
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    try {
      await getStorage().putFile(filename, buffer, EXT_MIME[ext] || 'application/octet-stream');
    } catch (err) {
      console.error('[uploads]', err);
      return res.status(500).json({ error: 'Faylni saqlab bo‘lmadi' });
    }
    res.status(201).json({
      url: `/uploads/${filename}`,
      name: original,
      size: buffer.length,
      type: EXT_MIME[ext] || 'application/octet-stream',
    });
  },
);

/* ------------------------------------------------------------------ */
/* admin — integratsiya kalitlari                                     */
/*                                                                    */
/* A partner site is given a key from the panel; the plaintext is      */
/* returned once and stored only as a hash.                           */
/* ------------------------------------------------------------------ */

app.get('/api/admin/integration/scopes', auth(), requireRole('superadmin', 'admin'), (_req, res) =>
  res.json(SCOPES),
);

app.get('/api/admin/integration/keys', auth(), requireRole('superadmin', 'admin'), (_req, res) =>
  res.json(getApiKeys()),
);

app.post('/api/admin/integration/keys', auth(), requireRole('superadmin'), (req, res) =>
  handle(res, () => createApiKey(req.body || {}, req.user.name)),
);

app.patch('/api/admin/integration/keys/:id', auth(), requireRole('superadmin'), (req, res) =>
  handle(res, () => updateApiKey(req.params.id, req.body || {}, req.user.name)),
);

app.delete('/api/admin/integration/keys/:id', auth(), requireRole('superadmin'), (req, res) =>
  handle(res, () => deleteApiKey(req.params.id, req.user.name)),
);

/* ------------------------------------------------------------------ */
/* /api/v1 — what a partner site may call                             */
/*                                                                    */
/* Authenticated with an API key, scoped, rate limited, and read-only  */
/* apart from submitting an order request.                             */
/* ------------------------------------------------------------------ */

const v1 = express.Router();
v1.use(integrationLimiter);

v1.get('/ping', requireApiKey('catalog:read'), (req, res) =>
  res.json({ ok: true, key: req.apiKey.name, scopes: req.apiKey.scopes, time: new Date().toISOString() }),
);

v1.get('/categories', requireApiKey('catalog:read'), (_req, res) => res.json(categoriesWithCounts()));

v1.get('/products', requireApiKey('catalog:read'), (req, res) => {
  const { category, q, limit } = req.query;
  let list = getProducts();
  if (category && category !== 'all') list = list.filter((p) => p.category === category);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((p) => `${p.model} ${p.name} ${p.summary}`.toLowerCase().includes(needle));
  }
  const total = list.length;
  const take = Math.min(500, Number(limit) || 100);
  res.json({ total, items: list.slice(0, take) });
});

v1.get('/products/:id', requireApiKey('catalog:read'), (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

v1.get('/manuals/:id', requireApiKey('manuals:read'), (req, res) => {
  const manual = getManualById(req.params.id);
  if (!manual) return res.status(404).json({ error: 'Manual not found' });
  res.json(manual);
});

/** the register, without the commercial columns a partner has no business seeing */
v1.get('/assets', requireApiKey('assets:read'), (req, res) => {
  const list = filterAssets(getAssets(), req.query);
  res.json({
    total: list.length,
    items: list.slice(0, Math.min(500, Number(req.query.limit) || 100)).map((a) => ({
      id: a.id,
      name: a.name,
      model: a.model,
      serial: a.serial,
      status: a.status,
      classification: {
        group: a.classGroupName,
        section: a.classSectionName,
        item: a.classItemName,
      },
      region: a.regionName,
      district: a.districtName,
      organization: a.organization,
      warrantyUntil: a.warrantyUntil,
      lat: a.lat,
      lng: a.lng,
      updatedAt: a.updatedAt,
    })),
  });
});

v1.get('/assets/summary', requireApiKey('assets:read'), (req, res) => {
  const { totals, byRegion, byClass } = dashboardStats(req.query);
  res.json({ totals, byRegion, byClass });
});

v1.post('/inquiries', requireApiKey('inquiries:write'), (req, res) => {
  const { productId, contactName, phone, email, message, quantity, region } = req.body || {};
  if (!contactName || !phone) {
    return res.status(400).json({ error: 'contactName va phone majburiy' });
  }
  const product = productId ? getProductById(productId) : null;
  const db = readDb();
  const inquiry = {
    id: `inq-${crypto.randomUUID().slice(0, 8)}`,
    productId: product?.id || null,
    productModel: product?.model || null,
    productName: product?.name || null,
    category: product?.category || null,
    contactName: String(contactName).slice(0, 120),
    region: String(region || '').slice(0, 80),
    phone: String(phone).slice(0, 40),
    email: String(email || '').slice(0, 120),
    quantity: Number(quantity) > 0 ? Number(quantity) : 1,
    message: String(message || '').slice(0, 1200),
    status: 'new',
    assignedTo: null,
    source: req.apiKey.name,
    createdAt: new Date().toISOString(),
  };
  db.inquiries.unshift(inquiry);
  writeDb(db);
  logActivity('inquiry', req.apiKey.name, `${req.apiKey.name} integratsiyasidan yangi so‘rov`);
  res.status(201).json({ id: inquiry.id, status: inquiry.status });
});

app.use('/api/v1', v1);

/* ------------------------------------------------------------------ */
/* static client (production build)                                   */
/* ------------------------------------------------------------------ */

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

/**
 * The last stop for anything thrown upstream.
 *
 * Body-parser and CORS both throw errors that already carry the right status;
 * returning 500 for them told a caller "the server broke" when the truth was
 * "your request was refused", and buried the reason in the log. Only genuinely
 * unexpected failures are reported as 500, and only those are logged in full.
 */
app.use((err, req, res, _next) => {
  const status = Number(err.status || err.statusCode) || 0;

  if (err.type === 'entity.too.large' || status === 413) {
    return res.status(413).json({ error: 'So‘rov hajmi juda katta' });
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'JSON noto‘g‘ri formatda' });
  }
  if (/^CORS:/.test(err.message || '')) {
    return res.status(403).json({ error: 'Bu manzilga ruxsat berilmagan' });
  }
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.expose ? err.message : 'So‘rov rad etildi' });
  }

  // never let an internal message or a stack trace reach the caller
  console.error('[server]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: 'Unexpected server error' });
});

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

const start = async () => {
  await initDb();
  const store = getStorage();

  // the disk backend needs its uploads folder; Postgres does not
  if (store.kind === 'disk') fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const server = app.listen(PORT, HOST, () => {
    const where = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`\n  Gold Med Nova API  →  http://${where}:${PORT}/api/health`);
    console.log(`  Rejim              →  ${isProduction ? 'production' : 'development'}`);
    console.log(
      `  Ma'lumotlar        →  ${store.kind === 'postgres' ? 'Postgres' : 'disk'} · ${store.describe}`,
    );
    if (store.kind === 'disk' && !process.env.DATA_DIR) {
      console.warn(
        '\n  [diqqat] DATA_DIR ham, DATABASE_URL ham berilmagan.\n' +
          '  Bulutda bu degani — server har qayta ishga tushganda hamma\n' +
          "  kiritilgan ma'lumot yo'qoladi. DEPLOY.md ga qarang.\n",
      );
    }
    console.log(`  Boshqaruv paneli   →  http://${where}:${PORT}/adm1n\n`);

    // A generated administrator password is shown once, here, and never
    // written anywhere else. Copy it before this line scrolls away.
    for (const { username, password } of generatedPasswords) {
      console.log('  ┌──────────────────────────────────────────────────────┐');
      console.log('  │  BIRINCHI KIRISH UCHUN PAROL (faqat bir marta)       │');
      console.log('  ├──────────────────────────────────────────────────────┤');
      console.log(`  │  login : ${username.padEnd(43)}│`);
      console.log(`  │  parol : ${password.padEnd(43)}│`);
      console.log('  ├──────────────────────────────────────────────────────┤');
      console.log('  │  Kirgach darhol Sozlamalardan almashtiring.          │');
      console.log('  └──────────────────────────────────────────────────────┘\n');
    }
    generatedPasswords.length = 0;
  });

  /**
   * Finish in-flight requests, then make sure the last change reached the
   * backend before the process goes away. Cloud hosts send SIGTERM on every
   * redeploy, so this runs often — losing the final edit each time would be
   * a slow, silent data leak.
   */
  let closing = false;
  const shutdown = (signal) => async () => {
    if (closing) return;
    closing = true;
    console.log(`\n[server] ${signal} — to‘xtatilmoqda…`);
    server.close();
    try {
      await closeDb();
    } catch (err) {
      console.error('[server] saqlashda xato:', err.message);
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
};

process.on('unhandledRejection', (err) => console.error('[server] unhandled rejection:', err));

start().catch((err) => {
  console.error('[server] ishga tushmadi:', err);
  process.exit(1);
});
