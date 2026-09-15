#!/usr/bin/env bash
#
# Botni systemd xizmatiga aylantiradi: server qayta yuklansa ham o'zi yonadi,
# bot qulasa ham 10 soniyada o'zi tiklanadi.
#
# Ishlatish (bot papkasidan):
#     sudo bash deploy/ornatish.sh
#
set -euo pipefail

XIZMAT="daftar-bot"
UNIT="/etc/systemd/system/${XIZMAT}.service"

qadam() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
xato()  { printf '\n\033[31m❌ %s\033[0m\n\n' "$1" >&2; exit 1; }
ogoh()  { printf '\033[33m⚠  %s\033[0m\n' "$1"; }
mayli() { printf '\033[32m✓\033[0m %s\n' "$1"; }

# ── 1. root huquqi ──────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || xato "Bu skript root huquqini talab qiladi:  sudo bash deploy/ornatish.sh"

# ── 2. papka va foydalanuvchi ───────────────────────────────────────────
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$DEPLOY_DIR")"

[ -f "$APP_DIR/src/index.js" ] || xato "Bot fayllari topilmadi. Skriptni bot papkasidan ishlating."

# xizmat kim nomidan ishlaydi: sudo qilgan odam, bo'lmasa papka egasi
EGA="${SUDO_USER:-$(stat -c '%U' "$APP_DIR")}"
[ "$EGA" != "root" ] || ogoh "Xizmat root nomidan ishlaydi. Oddiy foydalanuvchi yaratgan ma'qul (VPS.md, 3-bo'lim)."

id "$EGA" >/dev/null 2>&1 || xato "'$EGA' degan foydalanuvchi yo'q."

qadam "Papka va foydalanuvchi"
mayli "Papka:         $APP_DIR"
mayli "Foydalanuvchi: $EGA"

# ── 3. Node ─────────────────────────────────────────────────────────────
qadam "Node.js"
command -v node >/dev/null 2>&1 || xato "Node.js o'rnatilmagan. VPS.md dagi 4-bo'limga qarang."

NODE_BIN="$(command -v node)"
NODE_KATTA="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_KATTA" -ge 20 ] || xato "Node $NODE_KATTA topildi, kamida 20 kerak. VPS.md, 4-bo'lim."
mayli "$(node -v)  ($NODE_BIN)"

# ── 4. bog'liqliklar ────────────────────────────────────────────────────
qadam "Bog'liqliklar"
if [ ! -d "$APP_DIR/node_modules" ]; then
  ogoh "node_modules yo'q — o'rnatilmoqda…"
  sudo -u "$EGA" env -C "$APP_DIR" npm install --omit=dev
fi
mayli "node_modules joyida"

# ── 5. sozlama ──────────────────────────────────────────────────────────
qadam "Sozlama (.env)"
[ -f "$APP_DIR/.env" ] || xato ".env fayli yo'q. Avval:  cp .env.example .env && nano .env"

yetishmaydi=()
grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$APP_DIR/.env" || yetishmaydi+=("TELEGRAM_BOT_TOKEN")
grep -qE '^(DEEPSEEK_API_KEY|ANTHROPIC_API_KEY)=.+' "$APP_DIR/.env" || yetishmaydi+=("DEEPSEEK_API_KEY")
[ ${#yetishmaydi[@]} -eq 0 ] || xato ".env da to'ldirilmagan: ${yetishmaydi[*]}"

grep -qE '^OWNER_ID=[0-9]+' "$APP_DIR/.env" \
  || ogoh "OWNER_ID bo'sh — bot javob bermaydi va eslatmaydi. Botga /id yozib, raqamni .env ga qo'ying."

chmod 600 "$APP_DIR/.env"
chown "$EGA" "$APP_DIR/.env"
mayli ".env to'ldirilgan va himoyalangan (faqat $EGA o'qiy oladi)"

# ── 6. ma'lumot papkasi ─────────────────────────────────────────────────
install -d -o "$EGA" -g "$(id -gn "$EGA")" "$APP_DIR/data"
mayli "data/ papkasi tayyor"

# ── 7. systemd ──────────────────────────────────────────────────────────
qadam "systemd xizmati"
command -v systemctl >/dev/null 2>&1 || xato "Bu tizimda systemd yo'q."
# systemctl fayli bor-u, systemd init sifatida ishlamayotgan bo'lishi mumkin
# (Docker, WSL1, konteyner) — unda xizmat yaratishning ma'nosi yo'q
[ -d /run/systemd/system ] || xato "systemd init sifatida ishlamayapti (konteyner yoki WSL1?). Bunday joyda xizmat yaratib bo'lmaydi — \"npm start\" bilan qo'lda ishlating."

if systemctl is-active --quiet "$XIZMAT" 2>/dev/null; then
  ogoh "Xizmat ishlayapti — yangilash uchun to'xtatilmoqda"
  systemctl stop "$XIZMAT"
fi

cat > "$UNIT" <<UNIT_FAYLI
[Unit]
Description=Daftar bot — shaxsiy hisob-kitob agenti
Documentation=file://$APP_DIR/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$EGA
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$XIZMAT

# xavfsizlik: botga faqat o'z data/ papkasiga yozish kerak
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=$APP_DIR/data

[Install]
WantedBy=multi-user.target
UNIT_FAYLI

chmod 644 "$UNIT"
systemctl daemon-reload
systemctl enable --quiet "$XIZMAT"
systemctl start "$XIZMAT"
mayli "Xizmat yozildi: $UNIT"

# ── 8. natija ───────────────────────────────────────────────────────────
sleep 3
qadam "Holat"

if systemctl is-active --quiet "$XIZMAT"; then
  systemctl --no-pager --lines=0 status "$XIZMAT" || true
  printf '\n\033[32m✅ Bot ishga tushdi va endi doimiy ishlaydi.\033[0m\n\n'
  printf 'Oxirgi loglar:\n'
  journalctl -u "$XIZMAT" --no-pager -n 12 || true
  cat <<'KEYIN'

Foydali buyruqlar:
  sudo systemctl status daftar-bot     — holati
  sudo systemctl restart daftar-bot    — qayta ishga tushirish
  journalctl -u daftar-bot -f          — loglarni jonli kuzatish

.env ni o'zgartirsangiz, qayta ishga tushirish shart.

KEYIN
else
  printf '\n\033[31m❌ Xizmat ishga tushmadi. Sababi:\033[0m\n\n'
  journalctl -u "$XIZMAT" --no-pager -n 30 || true
  exit 1
fi
