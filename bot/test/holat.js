/**
 * "npm run holat" — qaysi kod, qayerda, qanday sozlama bilan ishlayotganini
 * bitta ekranda ko'rsatadi.
 *
 * "Tuzatdim, lekin baribir eski xato chiqyapti" degan holat uchun: bu skript
 * loyihaning AYNI SHU nusxasini tekshiradi va tuzatish ichida bor-yo'qligini
 * haqiqiy chaqiruv bilan isbotlaydi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ILDIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OK = '✅';
const XATO = '❌';

const qator = (nom, qiymat) => console.log(`  ${nom.padEnd(18)} ${qiymat}`);

console.log('\n\u{1F4CB} Daftar — holat\n');

/* ── qayerda ────────────────────────────────────────────────────────── */
qator('Papka:', ILDIZ);
qator('Node:', process.version);

let paket = {};
try {
  paket = JSON.parse(fs.readFileSync(path.join(ILDIZ, 'package.json'), 'utf8'));
} catch { /* yo'q bo'lsa quyida ko'rinadi */ }
qator('Versiya:', paket.version || '(package.json o‘qilmadi)');

/* ── git ────────────────────────────────────────────────────────────── */
try {
  const git = (...args) => execFileSync('git', args, { cwd: ILDIZ, encoding: 'utf8' }).trim();
  qator('Shox:', git('rev-parse', '--abbrev-ref', 'HEAD'));
  qator('Commit:', git('log', '-1', '--format=%h  %ad  %s', '--date=short'));
  const ozgargan = git('status', '--porcelain');
  if (ozgargan) {
    console.log(`\n  ⚠ Saqlanmagan o‘zgarishlar bor — "git pull" to‘xtab qolishi mumkin:`);
    for (const q of ozgargan.split('\n').slice(0, 10)) console.log(`     ${q}`);
  }
} catch {
  qator('Git:', '(topilmadi yoki bu papka git ombori emas)');
}

/* ── tuzatish shu nusxada bormi? ────────────────────────────────────── */
console.log('\n\u{1F50E} Ovoz tuzatishi (.oga → .ogg)\n');

try {
  const { faylniTayyorlash } = await import('../src/asr.js');
  const natija = faylniTayyorlash('voice/file_123.oga');

  if (natija.nom.endsWith('.ogg')) {
    console.log(`  ${OK} Bor. "file_123.oga" → "${natija.nom}" (${natija.tur})`);
  } else {
    console.log(`  ${XATO} Ishlamadi: "${natija.nom}"`);
  }
} catch (xato) {
  console.log(`  ${XATO} Tuzatish bu nusxada YO‘Q.`);
  console.log(`     (${xato.message})`);
  console.log('\n     Demak kod eski. Tuzatish:');
  console.log('       git pull');
  console.log('     "Already up to date" desa-yu versiya eski bo‘lsa, boshqa');
  console.log('     papkada ishlayapsiz — yuqoridagi "Papka:" qatoriga qarang.');
}

/* ── sozlama ────────────────────────────────────────────────────────── */
console.log('\n⚙ Sozlama\n');
try {
  const { sozlamalar } = await import('../src/config.js');
  const cfg = sozlamalar({ telegramShart: false });
  qator('Til modeli:', `${cfg.xizmat} / ${cfg.model}`);
  qator('Ovoz:', cfg.asr === 'yoq' ? 'o‘chirilgan (kalit yo‘q)' : `${cfg.asr} / ${cfg.asrModel}`);
  if (cfg.asr !== 'yoq') qator('Ovoz manzili:', cfg.asrAsos);
  qator('Baza:', cfg.bazaYoli);
  qator('Vaqt:', cfg.vaqtMintaqasi);
} catch (xato) {
  console.log(`  ${XATO} ${xato.message.split('\n')[0]}`);
}

/* -- ishlab turgan nusxalar --------------------------------------- */
console.log('\n\u{1F504} Ishlab turgan bot nusxalari\n');
try {
  const windows = process.platform === 'win32';
  const xom = windows
    ? execFileSync('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_Process -Filter "name=\'node.exe\'" '
      + '| ForEach-Object { "$($_.ProcessId)  $($_.CommandLine)" }'],
    { encoding: 'utf8' })
    : execFileSync('bash', ['-c', 'ps -eo pid,args'], { encoding: 'utf8' });

  // faqat botga tegishli jarayonlar - qolgani shovqin
  // "node ... src/index.js" shaklidagilar; o'rovchi qobiq va timeout emas
  // buyruq aynan node bilan boshlanishi kerak - "timeout ... node ..." kabi
  // o'rovchilar alohida nusxa emas
  const BOT = /^\d+\s+"?[^\s"]*\bnode(\.exe)?"?\s+(--\S+\s+)*\S*src[\\/](index|chat)\.js/i;
  const botlar = xom.split('\n')
    .map((q) => q.trim())
    .filter((q) => BOT.test(q) && !/holat\.js|\bgrep\b/.test(q));

  if (!botlar.length) {
    console.log('  (bot ishlamayapti)');
  } else {
    for (const q of botlar) console.log(`  ${q.slice(0, 160)}`);
    if (botlar.length > 1) {
      console.log(`\n  \u26A0 ${botlar.length} ta nusxa ishlayapti \u2014 Telegram faqat bittasiga ruxsat beradi.`);
      console.log(windows ? '     Stop-Process -Id <ID>' : '     kill <PID>');
    } else {
      console.log('\n  Kod yangilangan bo\u2018lsa, shu jarayonni qayta ishga tushiring:');
      console.log('     Ctrl+C, keyin  npm start');
    }
  }
} catch {
  console.log('  (jarayonlarni ko\u2018rib bo\u2018lmadi)');
}

console.log('');
