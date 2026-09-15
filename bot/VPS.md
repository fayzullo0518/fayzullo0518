# 🖥 VPS ga o'rnatish — to'liq qo'llanma

Noutbukda `npm start` qilsangiz, noutbuk o'chishi bilan bot ham to'xtaydi.
Eslatmalar kelmaydi, ovozli xabarlar javobsiz qoladi. Shuning uchun bot
doimiy yoqiq turadigan kichik serverda — VPS da yashashi kerak.

Bu qo'llanma noldan boshlaydi: server sotib olishdan to bot o'zi qayta
ishga tushadigan holatgacha. Linux bilmasangiz ham bo'ladi — har bir
buyruq nima qilishi yozilgan.

**Jami vaqt:** ~30 daqiqa. **Oyiga:** ~4-6 dollar.

---

## 1. VPS sotib olish

Botga juda kam resurs kerak — **eng arzon tarif yetadi** (1 yadro, 1 GB
xotira, 10 GB disk).

| Xizmat | Narxi | Izoh |
|---|---|---|
| [Hetzner](https://www.hetzner.com/cloud) | €3.79/oy | Eng arzoni, Germaniya/Finlandiya |
| [DigitalOcean](https://www.digitalocean.com) | $4-6/oy | Paneli eng sodda, yangi boshlovchiga qulay |
| [Vultr](https://www.vultr.com) | $2.50-5/oy | Ko'p joy tanlovi |

**Tanlashda:**

* **Operatsion tizim:** Ubuntu 24.04 LTS (yoki 22.04 LTS). Boshqasini
  tanlamang — quyidagi buyruqlar shunga mo'ljallangan.
* **Joylashuv:** Germaniya, Finlandiya yoki Niderlandiya. Bu yerlardan
  Telegram ham, DeepSeek ham bemalol ochiladi. Toshkentdan ~80 ms —
  bot uchun sezilmaydi.
* **Tarif:** eng kichigi. Keyin kerak bo'lsa oshirasiz.

Sotib olgach sizga **IP manzil** (masalan `203.0.113.45`) va **root
paroli** (yoki SSH kaliti) beriladi. Shu ikkisi kerak bo'ladi.

---

## 2. Serverga ulanish

**Windows:** «Пуск» → `PowerShell` yozing va oching.
**Mac / Linux:** Terminal oching.

```bash
ssh root@203.0.113.45
```

`203.0.113.45` o'rniga o'z IP'ingizni yozing. Birinchi marta
`Are you sure you want to continue connecting?` deb so'raydi — `yes` deb
javob bering. Keyin parolni so'raydi.

> Parol yozganda ekranda hech narsa ko'rinmaydi — bu normal, shunchaki
> yozib Enter bosing.

Ulangach shunday ko'rinish chiqadi:

```
root@ubuntu-2gb-nbg1-1:~#
```

**Tayyor** — endi siz serverdasiz. Buyruqlarni shu yerga yozasiz.

---

## 3. Xavfsizlik (5 daqiqa, lekin o'tkazib yubormang)

Bu botda sizning moliyaviy yozuvlaringiz turadi. Bir necha oddiy qadam.

### 3.1. Tizimni yangilash

```bash
apt update && apt upgrade -y
```

### 3.2. Oddiy foydalanuvchi yaratish

Root bilan doimiy ishlash xavfli — bitta xato buyruq serverni buzadi.

```bash
adduser daftar
```

Parol so'raydi — o'ylab topib yozing va **eslab qoling**. Qolgan savollarni
(ism, telefon) bo'sh qoldirib Enter bosaverasiz.

Unga administrator huquqini beramiz:

```bash
usermod -aG sudo daftar
```

### 3.3. Avtomatik xavfsizlik yangilanishlari

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

Chiqqan oynada **Yes** ni tanlang. Endi server xavfsizlik yamoqlarini
o'zi o'rnatib turadi.

### 3.4. Xavfsizlik devori

Bot faqat **tashqariga** ulanadi (Telegram va DeepSeek'ga). Tashqaridan
unga hech kim ulanmaydi — shuning uchun faqat SSH portini ochamiz:

```bash
ufw allow OpenSSH
ufw --force enable
```

Tekshirish:

```bash
ufw status
```

`22/tcp ALLOW` ko'rinsa — to'g'ri.

### 3.5. Yangi foydalanuvchiga o'tish

```bash
su - daftar
```

Endi satr `daftar@...$` bo'lib o'zgaradi. **Bundan keyingi hamma ish shu
foydalanuvchi ostida.**

---

## 4. Node.js o'rnatish

Ubuntu'ning o'z omborida Node eski bo'ladi, shuning uchun rasmiy manbadan
o'rnatamiz:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
```

Tekshirish:

```bash
node -v
```

`v22.x.x` (yoki kamida `v20`) chiqishi kerak.

---

## 5. Kodni olish

```bash
cd ~
git clone -b claude/agent-tariff-settings-m5z91j https://github.com/fayzullo0518/fayzullo0518 daftar-bot
cd daftar-bot/bot
npm install
```

`npm install` bir necha soniya ishlaydi. Bog'liqliklar atigi ikkita,
shuning uchun tez tugaydi.

---

## 6. Sozlash

```bash
cp .env.example .env
nano .env
```

`nano` — oddiy matn muharriri. Kalitlaringizni to'ldiring:

```ini
TELEGRAM_BOT_TOKEN=1234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-...
OWNER_ID=
OPENAI_API_KEY=sk-...        # ovozli xabar uchun
TIMEZONE=Asia/Tashkent
ESLATMA_SOATI=9
```

Saqlash: **Ctrl+O** → **Enter** → **Ctrl+X**.

Faylni himoyalab qo'yamiz — faqat siz o'qiy olasiz:

```bash
chmod 600 .env
```

> **Server vaqti muhim emas.** Bot sanalarni `TIMEZONE` bo'yicha o'zi
> hisoblaydi, server Germaniyada bo'lsa ham eslatma Toshkent vaqtida keladi.

---

## 7. Sinab ko'rish

Xizmat qilib qo'yishdan oldin qo'lda ishga tushirib ko'ramiz.

```bash
npm run tekshir
```

Hammasi yashil bo'lishi kerak:

```
✅ .env o'qildi
✅ Baza yoziladi: /home/daftar/daftar-bot/bot/data/daftar.json
✅ Telegram: @sizning_botingiz
✅ deepseek javob berdi: "ha"
✅ Ovoz xizmati (openai) kalitni qabul qildi
```

Qizil chiqsa — o'sha qatorda sabab yozilgan, oxiridagi jadvalga qarang.

Endi ishga tushiramiz:

```bash
npm start
```

Telegramda botingizga **`/id`** yozing. U raqamingizni aytadi. **Ctrl+C**
bilan to'xtatib, raqamni `.env` ga yozing:

```bash
nano .env      # OWNER_ID=123456789
```

Yana `npm start` qiling va botga bir nima yozib ko'ring:

```
Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to'laydi
```

Javob kelsa — **hammasi ishlayapti.** Ctrl+C bilan to'xtating va keyingi
bosqichga o'ting.

---

## 8. Doimiy xizmat qilish (systemd)

Hozircha bot faqat terminal ochiq turganda ishlaydi. Endi uni tizim
xizmatiga aylantiramiz: server qayta yuklansa ham o'zi yonadi, bot
qulasa ham o'zi tiklanadi.

Omborda tayyor skript bor:

```bash
sudo bash deploy/ornatish.sh
```

Skript nima qiladi:

* Node versiyasini tekshiradi
* `.env` to'ldirilganini tekshiradi
* `daftar-bot.service` faylini yaratadi
* Xizmatni yoqadi va ishga tushiradi

Oxirida holatni ko'rsatadi. `active (running)` bo'lsa — tayyor.

<details>
<summary>Qo'lda qilish (skriptsiz)</summary>

```bash
sudo nano /etc/systemd/system/daftar-bot.service
```

```ini
[Unit]
Description=Daftar bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=daftar
WorkingDirectory=/home/daftar/daftar-bot/bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# xavfsizlik cheklovlari
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/daftar/daftar-bot/bot/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now daftar-bot
```
</details>

---

## 9. Kundalik ishlar

Hammasi `systemctl` orqali:

```bash
sudo systemctl status daftar-bot     # ishlayaptimi?
sudo systemctl restart daftar-bot    # qayta ishga tushirish
sudo systemctl stop daftar-bot       # to'xtatish
sudo systemctl start daftar-bot      # yoqish
```

**Loglarni ko'rish** — bot nima qilayotganini kuzatish:

```bash
journalctl -u daftar-bot -f          # jonli oqim (chiqish: Ctrl+C)
journalctl -u daftar-bot -n 50       # oxirgi 50 qator
journalctl -u daftar-bot --since today
```

**Sozlamani o'zgartirsangiz** (`.env` ni tahrirlasangiz) — qayta ishga
tushirish shart:

```bash
nano .env
sudo systemctl restart daftar-bot
```

**Kodni yangilash:**

```bash
cd ~/daftar-bot
git pull
cd bot && npm install
sudo systemctl restart daftar-bot
```

---

## 10. Zaxira nusxa

Hamma yozuvlaringiz bitta faylda: `bot/data/daftar.json`. Uni yo'qotib
qo'ymaslik kerak.

### Serverda avtomatik zaxira

```bash
cd ~/daftar-bot/bot
chmod +x deploy/zaxira.sh
crontab -e
```

Birinchi marta muharrir tanlashni so'raydi — `1` (nano) ni tanlang.
Fayl oxiriga qo'shing:

```cron
0 3 * * * /home/daftar/daftar-bot/bot/deploy/zaxira.sh
```

Endi har kuni soat 3:00 da nusxa olinadi va 30 kunlik tarix saqlanadi
(`bot/data/zaxira/` papkasida).

### O'z kompyuteringizga tushirish

Vaqti-vaqti bilan o'zingizga ham ko'chirib qo'ying. **O'z kompyuteringizda**
(serverda emas):

```bash
scp daftar@203.0.113.45:~/daftar-bot/bot/data/daftar.json ~/Downloads/
```

### Eng sodda usul

Botga `/excel` yozing — fayl Telegramga keladi va sizning telefoningizda
qoladi. Bu ham zaxira, server bilan bog'liq emas.

---

## 11. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| `status` da `active (running)` yo'q | `journalctl -u daftar-bot -n 50` — sabab shu yerda |
| Log'da `409` | Bot ikki joyda ishlayapti. Noutbukdagi nusxani to'xtating |
| `.env fayli to'liq emas` | `.env` da token yoki kalit yo'q. `nano .env` |
| `DeepSeek balansi tugagan` | platform.deepseek.com da hisobni to'ldiring |
| `Host not in allowlist` | Serveringiz tarmog'i o'sha manzilni bloklayapti — provayderni almashtiring |
| Bot javob bermaydi | `OWNER_ID` noto'g'ri. Botga `/id` yozib tekshiring |
| Eslatma noto'g'ri vaqtda | `.env` dagi `TIMEZONE` va `ESLATMA_SOATI` ni tekshiring |
| `Permission denied` | `sudo` qo'shishni unutdingiz, yoki `daftar` foydalanuvchisi emassiz |
| `node: command not found` | 4-bosqichni qaytadan bajaring |
| SSH ulanmayapti | IP to'g'rimi? Provayder panelida server yoqiqmi? |

**Har qanday holatda birinchi qadam:**

```bash
sudo systemctl status daftar-bot
journalctl -u daftar-bot -n 50
npm run tekshir
```

Shu uchtasining natijasini ko'rsatsangiz, muammoni aniqlash oson bo'ladi.

---

## 12. Xarajat

| Nima | Oyiga |
|---|---|
| VPS (eng kichik tarif) | $4-6 |
| DeepSeek (kuniga ~25 xabar) | ~$0.3 |
| Whisper (kuniga ~5 daqiqa ovoz) | ~$0.5 |
| **Jami** | **~$5-7** |

DeepSeek va Whisper hisobiga oldindan $5 qo'ysangiz, bir necha oyga
yetadi. Balans tugasa bot xato xabarini yuboradi — shunda to'ldirasiz.

---

## Qisqacha shpargalka

```bash
ssh daftar@SERVER_IP                  # ulanish
cd ~/daftar-bot/bot                   # bot papkasi

sudo systemctl status daftar-bot      # holati
sudo systemctl restart daftar-bot     # qayta yoqish
journalctl -u daftar-bot -f           # loglar

nano .env                             # sozlama
npm run tekshir                       # diagnostika

cd ~/daftar-bot && git pull && cd bot && npm install && sudo systemctl restart daftar-bot
```
