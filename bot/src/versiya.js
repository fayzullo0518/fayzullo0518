/**
 * Qaysi versiya ishlab turganini bilish uchun.
 *
 * "git pull" qilingani bilan ishlab turgan jarayon eski kodni ushlab
 * qoladi - qayta ishga tushirilmaguncha. Shuning uchun versiya ishga
 * tushishda va diagnostikada ko'rsatiladi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

export function versiya() {
  let raqam = '?';
  try {
    raqam = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '?';
  } catch { /* o'qilmasa jim qolamiz */ }

  // git bo'lsa aniq commit ham ko'rsatiladi - qaysi kod ekani shubhasiz bo'ladi
  let commit = '';
  try {
    const gitDir = path.join(ROOT, '..', '.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5) : null;
    const sha = ref
      ? fs.readFileSync(path.join(gitDir, ref), 'utf8').trim()
      : head;
    if (/^[0-9a-f]{40}$/.test(sha)) commit = ` (${sha.slice(0, 7)})`;
  } catch { /* git yo'q bo'lsa muhim emas */ }

  return `${raqam}${commit}`;
}
