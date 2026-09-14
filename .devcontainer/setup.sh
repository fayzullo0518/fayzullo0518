#!/usr/bin/env bash
# Kodspeys birinchi marta yaratilganda bir marta ishlaydi.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> Kutubxonalar o'rnatilmoqda…"
npm install --prefix server --no-audit --no-fund
npm install --prefix client --no-audit --no-fund

echo "==> Sayt qurilmoqda…"
npm run build

# Ma'lumotlar /workspaces ichida turadi — kodspeys to'xtab qayta yonsa ham
# saqlanib qoladi. Konteyner obrazining ichida emas.
DATA_DIR="$ROOT/.data"
mkdir -p "$DATA_DIR"

if [ ! -f .env ]; then
  echo "==> Sozlamalar yaratilmoqda…"
  JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')"
  # o'qilishi oson, lekin taxmin qilib bo'lmaydigan parol
  ADMIN_PASSWORD="Gmn-$(node -e 'console.log(require("crypto").randomBytes(9).toString("base64url"))')-26"

  cat > .env <<ENV
NODE_ENV=production
PORT=5175
HOST=0.0.0.0

# Codespaces HTTPS'ni o'zi hal qiladi — aks holda cheksiz redirect bo'ladi
FORCE_HTTPS=false
TRUST_PROXY=1

JWT_SECRET=$JWT_SECRET
TOKEN_TTL=12h

ADMIN_USERNAME=fayzullo
ADMIN_PASSWORD=$ADMIN_PASSWORD

DATA_DIR=$DATA_DIR
ENV
  chmod 600 .env
fi

echo
echo "  ============================================================"
echo "   Tayyor. Kodspeys ochilganda sayt o'zi ishga tushadi."
echo
echo "   Login  : $(grep '^ADMIN_USERNAME=' .env | cut -d= -f2)"
echo "   Parol  : $(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)"
echo
echo "   Bu parol .env faylida saqlangan (git'ga tushmaydi)."
echo "  ============================================================"
echo
