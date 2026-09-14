#!/usr/bin/env bash
# Kodspeys har ochilganda saytni ishga tushiradi.
set -euo pipefail

cd "$(dirname "$0")/.."

# allaqachon ishlayotgan bo'lsa, ikkinchisini ochmaymiz
if curl -sf http://127.0.0.1:5175/api/health >/dev/null 2>&1; then
  echo "Sayt allaqachon ishlayapti."
  exit 0
fi

# qurilgan sayt yo'q bo'lsa (masalan kod yangilangan) — qayta quramiz
[ -d client/dist ] || npm run build

echo
echo "  Sayt ishga tushmoqda…"
echo "  Manzil PORTS bo'limida: 5175 -> Forwarded Address"
echo "  Admin panel: <manzil>/dev"
echo

exec node server/index.js
