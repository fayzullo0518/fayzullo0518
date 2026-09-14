/**
 * Fayllarni shifrlash kaliti yasaydi.
 *
 *   npm run secret:files
 *
 * Bu kalit faqat ASOSIY serverda turadi. Fayllar ombor serveriga
 * chiqishidan oldin shu kalit bilan shifrlanadi, ya'ni ombor serveriga
 * kirgan buzg'unchi o'qib bo'lmaydigan baytlarni topadi.
 *
 * DIQQAT: kalit yo'qolsa, yuklangan fayllarni HECH KIM ocha olmaydi —
 * na siz, na men. Uni parolingiz bilan bir joyda saqlang.
 */
import crypto from 'node:crypto';

const key = crypto.randomBytes(32).toString('base64');

console.log('\n  .env fayliga quyidagini qo‘shing:\n');
console.log(`  FILE_ENCRYPTION_KEY=${key}\n`);
console.log('  Bu kalitni yo‘qotmang — yo‘qolsa fayllar butunlay ochilmaydi.\n');
