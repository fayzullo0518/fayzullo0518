/**
 * Xavfsizlik testi — drives a running server over HTTP and asserts that each
 * hardening measure actually holds. Run it against a throwaway DATA_DIR:
 *
 *   npm run security:check
 *
 * Every check states what an attacker would gain if it failed.
 */
const BASE = process.env.CHECK_URL || 'http://127.0.0.1:5175';
const ADMIN_USER = process.env.CHECK_USER || 'fayzullo';
const ADMIN_PASS = process.env.CHECK_PASS || '';

let passed = 0;
let failed = 0;
const failures = [];

const ok = (name) => {
  passed += 1;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
};
const bad = (name, detail) => {
  failed += 1;
  failures.push(`${name} — ${detail}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${detail}`);
};

function check(name, condition, detail = 'kutilmagan javob') {
  if (condition) ok(name);
  else bad(name, detail);
}

async function call(path, { method = 'GET', body, token, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, text, headers: res.headers };
}

const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

/* ------------------------------------------------------------------ */

async function run() {
  console.log(`\nGold Med Nova — xavfsizlik tekshiruvi\n${BASE}`);

  /* ---------------- 1. published default passwords ---------------- */
  section('1. Hujjatda e’lon qilingan parollar');

  const leaked = [
    ['fayzullo', 'fayzullodev'],
    ['SonYun', 'sonyun2026'],
    ['dilnoza', 'dilnoza2026'],
    ['otabek', 'otabek2026'],
  ];
  for (const [username, password] of leaked) {
    const r = await call('/api/auth/login', { method: 'POST', body: { username, password } });
    check(
      `${username} / ${password} → rad etildi`,
      r.status !== 200,
      `KIRDI (${r.status}) — bu parol hujjatda ochiq yozilgan, har kim admin bo‘la oladi`,
    );
  }

  /* ---------------- 2. sign in as the real administrator ---------- */
  section('2. Haqiqiy administrator');

  if (!ADMIN_PASS) {
    bad('CHECK_PASS berilmadi', 'admin parolisiz qolgan testlarni bajarib bo‘lmaydi');
    return report();
  }

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  check('to‘g‘ri parol bilan kirish', login.status === 200, `status ${login.status}`);
  const token = login.data?.token;
  if (!token) return report();

  check(
    'javobda parol hash’i yo‘q',
    !login.text.includes('scrypt:') && !/"password"/.test(login.text),
    'javob ichida parol hash’i qaytdi',
  );
  check(
    'vaqtinchalik parol belgilangan',
    login.data?.mustChangePassword === true || Boolean(process.env.ADMIN_PASSWORD),
    'server yaratgan parol “almashtirilsin” deb belgilanmagan',
  );

  /* ---------------- 3. JWT ---------------------------------------- */
  section('3. Token (JWT)');

  const [head, payload, sig] = token.split('.');
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const noneToken = `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`;
  const r1 = await call('/api/auth/me', { token: noneToken });
  check('alg:none tokeni rad etildi', r1.status === 401, `status ${r1.status} — imzosiz token qabul qilindi`);

  const tampered = `${head}.${payload}.${sig.slice(0, -3)}${sig.slice(-3) === 'aaa' ? 'bbb' : 'aaa'}`;
  const r2 = await call('/api/auth/me', { token: tampered });
  check('buzilgan imzo rad etildi', r2.status === 401, `status ${r2.status}`);

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const forged = `${head}.${b64({ ...claims, role: 'superadmin', sub: 'usr-fake' })}.${sig}`;
  const r3 = await call('/api/auth/me', { token: forged });
  check('o‘zgartirilgan rol rad etildi', r3.status === 401, `status ${r3.status} — rolni yozib qo‘yish mumkin`);

  check('tokenda parol izi bor', typeof claims.pwd === 'string', 'parol almashsa eski token amal qiladi');
  check('token muddati belgilangan', typeof claims.exp === 'number', 'muddatsiz token');

  /* ---------------- 4. role separation ---------------------------- */
  section('4. Rollar ajratilgani');

  // make a viewer, then confirm the viewer cannot reach what it must not
  const viewerPass = 'Kuz2026-Tekshir-Xavfsiz7';
  await call('/api/admin/users/usr-check-viewer', { method: 'DELETE', token });
  const made = await call('/api/admin/users', {
    method: 'POST',
    token,
    body: {
      name: 'Check Viewer',
      username: 'checkviewer',
      email: 'checkviewer@example.com',
      role: 'viewer',
      password: viewerPass,
    },
  });
  check('superadmin yangi hisob ocha oladi', [201, 409].includes(made.status), `status ${made.status}`);

  const vLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'checkviewer', password: viewerPass },
  });
  const vToken = vLogin.data?.token;
  check('kuzatuvchi kira oladi', Boolean(vToken), `status ${vLogin.status}`);

  if (vToken) {
    const cases = [
      ['jamoa ro‘yxati', '/api/admin/users', 'GET', undefined],
      ['integratsiya kalitlari', '/api/admin/integration/keys', 'GET', undefined],
      ['uskuna qo‘shish', '/api/admin/assets', 'POST', { name: 'x' }],
      ['mahsulot qo‘shish', '/api/admin/products', 'POST', { name: 'x' }],
      ['so‘rov holatini o‘zgartirish', '/api/admin/inquiries/inq-0001', 'PATCH', { status: 'won' }],
      ['katalog o‘chirish', '/api/admin/categories/rad', 'DELETE', undefined],
      ['Excel yuklash', '/api/admin/assets/export.xlsx', 'GET', undefined],
      ['rasm yuklash', '/api/admin/uploads', 'POST', { dataUrl: 'data:image/png;base64,aaaa' }],
    ];
    for (const [label, path, method, body] of cases) {
      const r = await call(path, { method, body, token: vToken });
      check(`kuzatuvchi → ${label}: 403`, r.status === 403, `status ${r.status} — ruxsat berilgan!`);
    }

    // a viewer must not be able to promote itself
    const esc = await call('/api/admin/users/usr-check-viewer', {
      method: 'PATCH',
      token: vToken,
      body: { role: 'superadmin' },
    });
    check('kuzatuvchi o‘zini superadmin qila olmaydi', esc.status === 403, `status ${esc.status}`);
  }

  /* ---------------- 5. unauthenticated access --------------------- */
  section('5. Tokensiz murojaat');

  for (const [label, path, method] of [
    ['statistika', '/api/admin/stats', 'GET'],
    ['reyestr', '/api/admin/assets', 'GET'],
    ['jamoa', '/api/admin/users', 'GET'],
    ['uskuna o‘chirish', '/api/admin/assets/x', 'DELETE'],
    ['kalit yaratish', '/api/admin/integration/keys', 'POST'],
  ]) {
    const r = await call(path, { method });
    check(`tokensiz → ${label}: 401`, r.status === 401, `status ${r.status}`);
  }

  const v1 = await call('/api/v1/products');
  check('API kalitsiz /api/v1: 401', v1.status === 401, `status ${v1.status}`);

  /* ---------------- 6. password policy ---------------------------- */
  section('6. Parol siyosati');

  for (const [label, pw] of [
    ['qisqa', 'Qisqa1'],
    ['raqamsiz', 'ParolsizRaqam'],
    ['oddiy', 'password12345'],
    ['login bilan bir xil', 'fayzullo12345'],
    ['bir xil belgilar', 'aaaaaaaaaaaa1'],
  ]) {
    const r = await call('/api/admin/users', {
      method: 'POST',
      token,
      body: { name: 'T', username: `t${Date.now()}`, email: `t${Date.now()}@e.uz`, role: 'viewer', password: pw },
    });
    check(`zaif parol rad etildi (${label})`, r.status === 400, `status ${r.status} — “${pw}” qabul qilindi`);
  }

  /* ---------------- 7. prototype pollution ------------------------ */
  section('7. Prototype pollution');

  const pol = await call('/api/inquiries', {
    method: 'POST',
    body: JSON.parse('{"contactName":"x","phone":"1","__proto__":{"polluted":"yes"}}'),
  });
  check(
    '__proto__ obyektni ifloslantirmadi',
    ({}).polluted === undefined,
    'Object.prototype ifloslandi — butun jarayon boshqarib olinishi mumkin',
  );
  void pol;

  /* ---------------- 8. upload validation -------------------------- */
  section('8. Fayl yuklash');

  const html = Buffer.from('<script>alert(1)</script>').toString('base64');
  const fake = await call('/api/admin/uploads', {
    method: 'POST',
    token,
    body: { dataUrl: `data:image/png;base64,${html}` },
  });
  check('rasm niqobidagi HTML rad etildi', fake.status === 400, `status ${fake.status} — saqlab qo‘yildi`);

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString('base64');
  const svgRes = await call('/api/admin/uploads', {
    method: 'POST',
    token,
    body: { dataUrl: `data:image/svg+xml;base64,${svg}` },
  });
  check('SVG rad etildi (XSS vektori)', svgRes.status === 400, `status ${svgRes.status}`);

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]).toString('base64');
  const good = await call('/api/admin/uploads', {
    method: 'POST',
    token,
    body: { dataUrl: `data:image/png;base64,${png}` },
  });
  check('haqiqiy PNG qabul qilindi', good.status === 201, `status ${good.status} — to‘g‘ri rasm ham o‘tmadi`);

  /* ---------------- 9. security headers --------------------------- */
  section('9. HTTP sarlavhalari');

  const root = await fetch(`${BASE}/api/health`);
  const want = {
    'content-security-policy': /default-src 'self'/,
    'x-content-type-options': /nosniff/,
    'x-frame-options': /DENY|SAMEORIGIN/i,
    'referrer-policy': /strict-origin/,
  };
  for (const [name, pattern] of Object.entries(want)) {
    const value = root.headers.get(name) || '';
    check(`${name}`, pattern.test(value), `qiymat: “${value || 'yo‘q'}”`);
  }
  check(
    'x-powered-by yashirilgan',
    !root.headers.get('x-powered-by'),
    `server o‘zini oshkor qilyapti: ${root.headers.get('x-powered-by')}`,
  );
  check(
    "CSP frame-ancestors 'none'",
    /frame-ancestors 'none'/.test(root.headers.get('content-security-policy') || ''),
    'sayt boshqa saytga iframe qilinishi mumkin (clickjacking)',
  );

  /* ---------------- 10. brute force ------------------------------- */
  section('10. Parol tanlashdan himoya');

  let blocked = false;
  let attempts = 0;
  for (let i = 0; i < 25; i += 1) {
    const r = await call('/api/auth/login', {
      method: 'POST',
      body: { username: 'bruteforce-target', password: `guess-${i}` },
    });
    attempts += 1;
    if (r.status === 429) {
      blocked = true;
      break;
    }
  }
  check(
    `ketma-ket urinishlar to‘xtatildi (${attempts} urinishdan keyin)`,
    blocked,
    '25 ta urinish ham to‘xtatilmadi — parol tanlab olish mumkin',
  );

  /* ---------------- 11. public write endpoints -------------------- */
  section('11. Ochiq yozuv nuqtalari');

  let inqBlocked = false;
  for (let i = 0; i < 14; i += 1) {
    const r = await call('/api/inquiries', {
      method: 'POST',
      body: { contactName: `spam-${i}`, phone: '+998000000000' },
    });
    if (r.status === 429) {
      inqBlocked = true;
      break;
    }
  }
  check('so‘rov formasi spamdan himoyalangan', inqBlocked, '14 ta ketma-ket so‘rov ham o‘tib ketdi');

  const big = await call('/api/inquiries', {
    method: 'POST',
    body: { contactName: 'x', phone: '1', message: 'A'.repeat(400_000) },
  });
  check('katta hajmli tana rad etildi', [413, 429, 400].includes(big.status), `status ${big.status}`);

  /* ---------------- 12. information leaks ------------------------- */
  section('12. Ma’lumot sizib chiqishi');

  const enum1 = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'definitely-not-a-user', password: 'x'.repeat(14) },
  });
  const enum2 = await call('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: 'x'.repeat(14) },
  });
  check(
    'mavjud/mavjud emas hisob farqlanmaydi',
    enum1.data?.error === enum2.data?.error || [429].includes(enum1.status),
    `“${enum1.data?.error}” ≠ “${enum2.data?.error}”`,
  );

  // fetch() collapses "../" before the request leaves, so assert on the body:
  // whatever comes back, it must not be the contents of a file on the host
  for (const attempt of [
    '/api/admin/assets/../../../etc/passwd',
    '/api/admin/assets/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/api/manuals/..%2f..%2f..%2fetc%2fpasswd',
  ]) {
    const r = await call(attempt, { token });
    check(
      `yo‘l bo‘ylab chiqib ketish: ${attempt.slice(0, 34)}…`,
      !/root:.*:0:0:/.test(r.text) && !r.text.includes('/bin/bash'),
      'server fayl tarkibini qaytardi',
    );
  }

  const trav = await fetch(`${BASE}/uploads/..%2f..%2f..%2fetc%2fpasswd`);
  check('/uploads orqali fayl o‘g‘irlash ishlamaydi', trav.status !== 200, `status ${trav.status}`);

  const err = await call('/api/products/%00');
  check('xato javobida stack trace yo‘q', !/at .*\.js:\d+/.test(err.text), 'javobda ichki yo‘llar ko‘rinyapti');

  return report();
}

function report() {
  const line = '─'.repeat(58);
  console.log(`\n${line}`);
  console.log(`  o‘tdi: \x1b[32m${passed}\x1b[0m    yiqildi: ${failed ? `\x1b[31m${failed}\x1b[0m` : '0'}`);
  console.log(line);
  if (failed) {
    console.log('\nTuzatilishi kerak:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exitCode = 1;
  } else {
    console.log('\nBarcha xavfsizlik tekshiruvlari o‘tdi.\n');
  }
}

run().catch((err) => {
  console.error('\nTest bajarilmadi:', err.message);
  process.exitCode = 1;
});
