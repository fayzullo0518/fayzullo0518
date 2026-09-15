#!/usr/bin/env bash
#
# Kunlik zaxira nusxa. 30 kunlik tarix saqlanadi, eskilari o'chiriladi.
#
# Qo'lda:   bash deploy/zaxira.sh
# Har kuni: crontab -e   →   0 3 * * * /to'liq/yo'l/bot/deploy/zaxira.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BAZA="$APP_DIR/data/daftar.json"
ZAXIRA_DIR="$APP_DIR/data/zaxira"
KUN=30

[ -f "$BAZA" ] || { echo "Baza fayli yo'q: $BAZA"; exit 0; }

mkdir -p "$ZAXIRA_DIR"
NUSXA="$ZAXIRA_DIR/daftar-$(date +%F).json"

# fayl yozilayotgan paytga tushib qolmaslik uchun avval tekshiramiz
if ! node -e "JSON.parse(require('fs').readFileSync('$BAZA','utf8'))" 2>/dev/null; then
  echo "Baza hozir o'qilmadi (yozilayotgan bo'lishi mumkin) — keyingi safar."
  exit 0
fi

cp "$BAZA" "$NUSXA"
YOZUVLAR="$(node -p "JSON.parse(require('fs').readFileSync('$NUSXA','utf8')).yozuvlar.length" 2>/dev/null || echo '?')"
echo "Zaxira: $NUSXA ($YOZUVLAR yozuv)"

# eskilarini tozalash
find "$ZAXIRA_DIR" -name 'daftar-*.json' -type f -mtime +$KUN -delete
QOLGAN="$(find "$ZAXIRA_DIR" -name 'daftar-*.json' -type f | wc -l)"
echo "Saqlanmoqda: $QOLGAN ta nusxa (oxirgi $KUN kun)"
