/**
 * Xavfsizlik qatlami — the hardening applied before any route runs.
 *
 * Everything here is defence the application needs once it is on a public
 * host: security headers and a content-security policy, a locked-down CORS
 * origin list, rate limits on the endpoints worth attacking, brute-force
 * protection on sign-in, and a JSON parser that refuses prototype-pollution
 * keys.
 */
import crypto from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import express from 'express';

export const isProduction = process.env.NODE_ENV === 'production';

/* ------------------------------------------------------------------ */
/* secrets                                                             */
/* ------------------------------------------------------------------ */

const DEV_SECRET = 'gold-med-nova-dev-secret-2026';

/**
 * In production the secret must come from the environment. Refusing to boot
 * is deliberate: a known signing key means anyone can mint an admin token.
 */
export function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (isProduction) {
    console.error(
      '\n  [xavfsizlik] JWT_SECRET o‘rnatilmagan yoki juda qisqa (kamida 32 belgi).\n' +
        '  .env faylga quyidagini qo‘shing:\n\n' +
        `  JWT_SECRET=${crypto.randomBytes(48).toString('base64url')}\n`,
    );
    process.exit(1);
  }
  if (fromEnv) console.warn('[xavfsizlik] JWT_SECRET juda qisqa — dev rejimda davom etilmoqda.');
  return fromEnv || DEV_SECRET;
}

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Same-origin in production unless ALLOWED_ORIGINS names the sites that may
 * call the API — that list is how a partner site is allowed to integrate.
 */
export function corsMiddleware() {
  const allowed = parseList(process.env.ALLOWED_ORIGINS);

  if (!isProduction && allowed.length === 0) return cors();

  return cors({
    origin(origin, callback) {
      // same-origin requests and server-to-server calls carry no Origin header
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error('CORS: bu manzilga ruxsat berilmagan'));
    },
    credentials: false,
    maxAge: 86400,
  });
}

/* ------------------------------------------------------------------ */
/* headers                                                             */
/* ------------------------------------------------------------------ */

/**
 * The client is a single bundle plus Leaflet tiles, so the policy can be
 * tight: scripts and styles from our own origin, images from our origin plus
 * the tile servers, and nothing framed.
 */
export function securityHeaders() {
  const tileHosts = [
    'https://*.tile.openstreetmap.org',
    'https://server.arcgisonline.com',
    'https://*.basemaps.cartocdn.com',
  ];

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // the bundle ships a few inline style attributes from the component library
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', ...tileHosts],
        connectSrc: ["'self'", ...parseList(process.env.ALLOWED_ORIGINS)],
        mediaSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  });
}

/* ------------------------------------------------------------------ */
/* rate limits                                                         */
/* ------------------------------------------------------------------ */

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

/** the whole API — a blunt ceiling that normal use never reaches */
export const apiLimiter = limiter(
  15 * 60 * 1000,
  1200,
  'So‘rovlar juda ko‘p — birozdan keyin qayta urinib ko‘ring.',
);

/** sign-in, per IP, on top of the per-account lockout below */
export const loginLimiter = limiter(
  15 * 60 * 1000,
  12,
  'Kirishga urinishlar juda ko‘p — 15 daqiqadan keyin qayta urinib ko‘ring.',
);

/** the public QR endpoint writes to the register, so it gets its own ceiling */
export const qrLimiter = limiter(
  10 * 60 * 1000,
  40,
  'Juda tez-tez o‘zgartirilmoqda — birozdan keyin urinib ko‘ring.',
);

/** uploads are expensive; 50 MB a piece deserves a limit */
export const uploadLimiter = limiter(
  60 * 60 * 1000,
  240,
  'Fayl yuklash chegarasiga yetdingiz — birozdan keyin davom eting.',
);

/**
 * The public order form writes a record to disk on every call, so it gets a
 * far tighter ceiling than the blanket API limit — otherwise one script can
 * fill the register with junk and the disk with it.
 */
export const inquiryLimiter = limiter(
  60 * 60 * 1000,
  8,
  'So‘rov yuborish chegarasiga yetdingiz — bir soatdan keyin urinib ko‘ring.',
);

/** anything a partner site calls */
export const integrationLimiter = limiter(
  15 * 60 * 1000,
  600,
  'Integratsiya so‘rovlari chegarasi — birozdan keyin qayta urinib ko‘ring.',
);

/* ------------------------------------------------------------------ */
/* brute-force protection on sign-in                                   */
/* ------------------------------------------------------------------ */

const FAILURES = new Map(); // key -> { count, until }
const MAX_FAILURES = 6;
const LOCK_MS = 15 * 60 * 1000;

const failureKey = (ip, username) => `${ip}::${String(username || '').toLowerCase()}`;

/** how many seconds the caller must wait, or 0 when they may try */
export function lockoutRemaining(ip, username) {
  const entry = FAILURES.get(failureKey(ip, username));
  if (!entry || entry.until < Date.now()) return 0;
  return Math.ceil((entry.until - Date.now()) / 1000);
}

export function recordLoginFailure(ip, username) {
  const key = failureKey(ip, username);
  const entry = FAILURES.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.until = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  FAILURES.set(key, entry);
}

export const clearLoginFailures = (ip, username) => FAILURES.delete(failureKey(ip, username));

// keep the map from growing without bound on a long-running server
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of FAILURES) {
      if (entry.until && entry.until < now) FAILURES.delete(key);
    }
  },
  30 * 60 * 1000,
).unref();

/* ------------------------------------------------------------------ */
/* request body safety                                                 */
/* ------------------------------------------------------------------ */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Drop the three keys that turn a JSON body into a prototype-pollution
 * attempt. The stores already copy field by field, so this is belt and
 * braces — but it costs nothing and closes the class of bug entirely.
 */
const safeReviver = (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value);

export const jsonParser = (limit = '2mb') => express.json({ limit, reviver: safeReviver });

/* ------------------------------------------------------------------ */
/* password policy                                                     */
/* ------------------------------------------------------------------ */

const COMMON = [
  'password', 'parol', '12345', 'qwerty', 'admin', 'welcome', 'letmein',
  'iloveyou', 'sunshine', 'goldmednova', 'medserv', 'nova2026',
];

/**
 * Returns an error message, or null when the password is acceptable.
 * @param {string} password
 * @param {string} [username] rejected as a substring — reusing the login as
 *   the password is the first thing any credential-stuffing list tries
 */
export function checkPasswordStrength(password, username = '') {
  const value = String(password || '');
  const lower = value.toLowerCase();

  if (value.length < 12) return 'Parol kamida 12 ta belgidan iborat bo‘lishi kerak';
  if (value.length > 200) return 'Parol juda uzun';
  if (!/[a-z]/i.test(value)) return 'Parolda harf bo‘lishi kerak';
  if (!/[0-9]/.test(value)) return 'Parolda kamida bitta raqam bo‘lishi kerak';
  if (COMMON.some((c) => lower.includes(c))) return 'Parol juda oddiy — boshqasini tanlang';

  const login = String(username || '').trim().toLowerCase();
  if (login.length >= 3 && lower.includes(login)) {
    return 'Parol login nomini o‘z ichiga olmasligi kerak';
  }
  // "aaaaaaaaaaaa" satisfies every rule above but is not a password
  if (new Set(lower).size < 5) return 'Parolda kamida 5 xil belgi bo‘lishi kerak';
  return null;
}

/* ------------------------------------------------------------------ */
/* upload content check                                                */
/* ------------------------------------------------------------------ */

const SIGNATURES = [
  [0xff, 0xd8, 0xff],                          // jpeg
  [0x89, 0x50, 0x4e, 0x47],                    // png
  [0x47, 0x49, 0x46, 0x38],                    // gif
  [0x42, 0x4d],                                // bmp
];

/**
 * Proof that the bytes really are an image, rather than a script that has
 * been handed a .jpg name. Covers the container formats too: WebP, AVIF and
 * HEIC all announce themselves a few bytes in.
 */
export function looksLikeImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  if (SIGNATURES.some((sig) => sig.every((byte, i) => buffer[i] === byte))) return true;

  const riff = buffer.toString('ascii', 0, 4);
  if (riff === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;

  // ISO base media: ....ftyp<brand>  — avif, heic, heif
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (['avif', 'avis', 'heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

/** everything that must run before the routes, in order */
export function applyBaseSecurity(app) {
  // behind nginx on uzcloud, the real client IP arrives in X-Forwarded-For
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)));
  app.disable('x-powered-by');

  app.use(securityHeaders());
  app.use(corsMiddleware());
  app.use(compression());

  // force HTTPS once a certificate is in front of the app
  if (isProduction && process.env.FORCE_HTTPS !== 'false') {
    app.use((req, res, next) => {
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    });
  }
}
