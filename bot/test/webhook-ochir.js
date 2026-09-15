/**
 * Webhook'ni olib tashlaydi — "npm run webhook-ochir".
 *
 * Bot long polling bilan ishlaydi. Agar tokenga webhook o'rnatilgan bo'lsa
 * (masalan, ilgari boshqa dasturda ishlatilgan bo'lsa), Telegram getUpdates
 * ga 409 qaytaradi va bot xabarlarni ololmaydi. Shu skript uni tozalaydi.
 */
import { sozlamalar } from '../src/config.js';
import { Telegram } from '../src/telegram.js';

let cfg;
try {
  cfg = sozlamalar();
} catch (xato) {
  console.error(`\n❌ ${xato.message}\n`);
  process.exit(1);
}

const telegram = new Telegram(cfg.token, cfg.telegramAsos);

try {
  const oldin = await telegram.webhookMalumoti();

  if (!oldin.url) {
    console.log('\n✅ Webhook o‘rnatilmagan — tozalashning hojati yo‘q.');
    if (oldin.pending_update_count) {
      console.log(`   Kutayotgan xabarlar: ${oldin.pending_update_count}`);
    }
    console.log('\n   409 xatosi chiqayotgan bo‘lsa, demak bot boshqa joyda ishlayapti.');
    console.log('   Windows:  Get-Process node | Select-Object Id, StartTime');
    console.log('   Linux:    pkill -f "node src/index.js"\n');
    process.exit(0);
  }

  console.log(`\n\u{1F517} Webhook topildi: ${oldin.url}`);
  if (oldin.pending_update_count) {
    console.log(`   Kutayotgan xabarlar: ${oldin.pending_update_count} (ular saqlanadi)`);
  }

  await telegram.webhookniOchirish();
  const keyin = await telegram.webhookMalumoti();

  if (keyin.url) {
    console.error('\n❌ Webhook baribir turibdi. Telegram tomonida muammo bo‘lishi mumkin.\n');
    process.exit(1);
  }

  console.log('\n✅ Webhook olib tashlandi. Endi:  npm start\n');
} catch (xato) {
  console.error(`\n❌ ${xato.message}\n`);
  process.exit(1);
}
