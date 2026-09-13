# Serverga joylash — uzcloud.uz

Ubuntu 22.04 / 24.04 uchun. Boshidan oxirigacha ~20 daqiqa.

---

## 1. Server tayyorlash

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx curl ufw fail2ban unzip

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # v20.x bo‘lishi kerak
```

### Xizmat uchun alohida foydalanuvchi

Ilova hech qachon `root` nomidan ishlamasin:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin goldmednova
sudo mkdir -p /var/www/goldmednova
sudo chown goldmednova:goldmednova /var/www/goldmednova
```

### Fayrvol

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Ilovaning o‘zi 5175-portda, faqat `127.0.0.1` da turadi — tashqaridan
unga to‘g‘ridan-to‘g‘ri kirib bo‘lmaydi, hamma narsa nginx orqali o‘tadi.

---

## 2. Loyihani yuklash

```bash
# arxivni serverga ko‘chiring (masalan scp bilan), keyin:
sudo -u goldmednova unzip goldmednovasayt.zip -d /tmp/gmn
sudo -u goldmednova cp -r /tmp/gmn/nova-med/* /var/www/goldmednova/
cd /var/www/goldmednova

sudo -u goldmednova npm run install:all
sudo -u goldmednova npm run build        # client/dist yasaydi
```

---

## 3. Sozlamalar

```bash
sudo -u goldmednova cp .env.example .env
sudo -u goldmednova npm run secret        # JWT_SECRET uchun kalit yasaydi
sudo -u goldmednova nano .env
```

`.env` da kamida shular bo‘lsin:

```
NODE_ENV=production
HOST=127.0.0.1
PORT=5175
TRUST_PROXY=1
JWT_SECRET=<npm run secret bergan qiymat>
```

Faylni faqat xizmat foydalanuvchisi o‘qiy olsin:

```bash
sudo chmod 600 /var/www/goldmednova/.env
sudo chown goldmednova:goldmednova /var/www/goldmednova/.env
```

> **Diqqat.** `NODE_ENV=production` bo‘lganda `JWT_SECRET` bo‘sh bo‘lsa
> server ataylab ishga tushmaydi — bu xato emas, himoya.

---

## 4. Xizmat sifatida ishga tushirish

```bash
sudo cp deploy/goldmednova.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now goldmednova
sudo systemctl status goldmednova
```

Tekshirish:

```bash
curl -s http://127.0.0.1:5175/api/health
```

---

## 5. nginx va HTTPS

`deploy/nginx.conf` dagi `goldmednova.uz` ni o‘z domeningizga almashtiring:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/goldmednova
sudo nano /etc/nginx/sites-available/goldmednova     # domenni yozing
sudo ln -s /etc/nginx/sites-available/goldmednova /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Sertifikat:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d goldmednova.uz -d www.goldmednova.uz
sudo systemctl enable --now certbot.timer      # avtomatik yangilanadi
```

---

## 6. Birinchi kirish

```
https://goldmednova.uz/dev          (yoki /adm1n)
```

Login — `.env` dagi `ADMIN_USERNAME` (odatda `fayzullo`).

Parol ikki joydan biridan olinadi:

* `.env` da `ADMIN_PASSWORD` yozgan bo‘lsangiz — o‘sha;
* bo‘sh qoldirgan bo‘lsangiz — server birinchi ishga tushganda tasodifiy
  parol yaratadi va jurnalga bir marta chiqaradi:

  ```bash
  sudo journalctl -u goldmednova --no-pager | grep -A2 'BIRINCHI KIRISH'
  ```

**Darhol bajaring:**

1. Panel → **Sozlamalar** → o‘z parolingizni qo‘ying
   (kamida 12 belgi, harf va raqam aralash, login nomi ichida bo‘lmasin).
   Server yaratgan parol bilan kirsangiz panelda ogohlantirish turadi.
2. **Jamoa** bo‘limidan `SonYun`, `dilnoza`, `otabek` hisoblariga parol
   bering yoki keraksizlarini o‘chiring — ular parolsiz yaratilgan va
   hozircha kira olmaydi.
3. Xavfsizlik testini yurgizing:

   ```bash
   CHECK_URL=https://goldmednova.uz CHECK_PASS='<yangi parol>' \
     npm run security:check
   ```

---

## 7. Zaxira nusxa

Butun ma’lumot ikki joyda: `server/data/db.json` va `server/data/uploads/`.

```bash
sudo tee /etc/cron.daily/goldmednova-backup >/dev/null <<'SH'
#!/bin/sh
STAMP=$(date +%Y-%m-%d)
mkdir -p /var/backups/goldmednova
tar czf /var/backups/goldmednova/gmn-$STAMP.tar.gz \
    -C /var/www/goldmednova/server data
find /var/backups/goldmednova -name 'gmn-*.tar.gz' -mtime +30 -delete
SH
sudo chmod +x /etc/cron.daily/goldmednova-backup
```

Tiklash: arxivni `server/` ichiga ochib, xizmatni qayta ishga tushiring.

---

## 8. Yangilash

```bash
cd /var/www/goldmednova
sudo systemctl stop goldmednova
# yangi fayllarni ko‘chiring (server/data ga TEGMANG)
sudo -u goldmednova npm run install:all
sudo -u goldmednova npm run build
sudo systemctl start goldmednova
```

---

## Qo‘yilgan himoya choralari

| Nima | Qanday |
| --- | --- |
| Xavfsizlik sarlavhalari | helmet — CSP, HSTS, nosniff, frame-ancestors: none |
| Parol saqlash | scrypt + har biriga alohida tuz (salt) |
| Sessiya | JWT, 12 soat, server tomonda tekshiriladi |
| Parolni tanlash | kamida 10 belgi, harf + raqam, oddiy parollar rad etiladi |
| Brute-force | 6 xato urinishdan keyin 15 daqiqa blok (IP + login bo‘yicha) |
| So‘rov chegarasi | API 1200/15 daq, kirish 12/15 daq, QR 40/10 daq, yuklash 240/soat |
| nginx darajasida | 20 so‘rov/soniya, 40 ulanish, 60 MB tana chegarasi |
| CORS | faqat `ALLOWED_ORIGINS` dagi saytlar |
| Prototype pollution | `__proto__`, `constructor`, `prototype` kalitlari tashlab yuboriladi |
| Fayl yuklash | kengaytma oq ro‘yxati, 50 MB, nomi UUID, nosniff bilan beriladi |
| Rollar | server tomonda `requireRole` — UI'ni aylanib o‘tib bo‘lmaydi |
| Integratsiya | kalit faqat hash holida saqlanadi, ruxsatlar (scope) bo‘yicha cheklangan |
| Audit | har bir o‘zgarish kim/qachon/nima bilan yoziladi |
| Jarayon | systemd, root emas, ProtectSystem=strict, faqat `data/` ga yozadi |
| Panel manzili | hech qayerda havola qilinmagan: faqat `/dev` yoki `/adm1n` |
