/**
 * Yangi JWT_SECRET yasaydi.
 *
 *   npm run secret
 *
 * Chiqqan qatorni .env fayliga ko‘chiring. Har bir server uchun alohida
 * kalit bo‘lsin — kalit ochiq bo‘lsa, istalgan kishi admin tokeni yasay oladi.
 */
import crypto from 'node:crypto';

const secret = crypto.randomBytes(48).toString('base64url');

console.log('\n  .env fayliga quyidagini qo‘shing:\n');
console.log(`  JWT_SECRET=${secret}\n`);
