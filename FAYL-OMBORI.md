# Fayllarni alohida arzon serverga chiqarish

## Muammo

Uskuna rasmlari, shartnomalar va hisob-fakturalar eng ko'p joy egallaydi.
VPS'ning NVMe diski esa eng qimmat gigabayt — 100 GB disk uchun oyiga
ancha pul to'laysiz, holbuki o'sha faylar deyarli hech qachon o'qilmaydi.

## Yechim

Ikkita server:

```
   Tashrifchi / admin
          │
          ▼
   ┌──────────────────┐        ┌─────────────────────┐
   │  ASOSIY SERVER   │        │   OMBOR SERVERI     │
   │  (qimmat, kichik)│───────▶│   (arzon, katta)    │
   │                  │◀───────│                     │
   │  · sayt          │        │  · faqat shifrlangan│
   │  · baza          │        │    fayllar          │
   │  · shifr KALITI  │        │  · kalit YO'Q       │
   └──────────────────┘        └─────────────────────┘
```

Fayl asosiy serverdan **chiqishidan oldin** shifrlanadi. Ombor serveri
faqat o'qib bo'lmaydigan baytlarni ko'radi. Ya'ni o'sha serverni
buzishsa ham, shartnomalarni o'qiy olishmaydi.

Tashrifchi hech qachon ombor serveriga to'g'ridan-to'g'ri bormaydi —
hamma so'rov asosiy server orqali o'tadi va **avval ruxsat tekshiriladi**:

| Fayl | Kim ocha oladi |
|---|---|
| Uskuna rasmi | hamma — QR stikerini skanerlagan shifokor tizimga kirmaydi |
| Shartnoma, hisob-faktura | faqat superadmin, admin, menejer |

## Ombor uchun nima tanlash mumkin

Ombor **S3'ga mos** bo'lishi kerak. Uch yo'l:

### 1. O'zingizning arzon ikkinchi serveringiz (MinIO)

Eng yaxshi variant: ma'lumot O'zbekistonda qoladi, ya'ni shaxsiy
ma'lumotlar to'g'risidagi qonun talabi bajariladi.

Arzon, katta diskli VPS oling (NVMe shart emas — oddiy HDD ham yetadi,
u ancha arzon) va MinIO o'rnating:

```bash
# ombor serverida
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio && sudo mv minio /usr/local/bin/

sudo useradd -r minio-user -s /sbin/nologin
sudo mkdir -p /mnt/ombor && sudo chown minio-user /mnt/ombor

sudo tee /etc/default/minio >/dev/null <<'CONF'
MINIO_VOLUMES="/mnt/ombor"
MINIO_OPTS="--address :9000 --console-address :9001"
MINIO_ROOT_USER=ombor-admin
MINIO_ROOT_PASSWORD=<kuchli-parol-32-belgi>
CONF

sudo systemctl enable --now minio
```

Keyin brauzerda `http://<ombor-ip>:9001` ni oching, `goldmednova` nomli
bucket yarating va faqat o'sha bucket'ga huquqi bor kalit oling.

**Muhim:** ombor serverining 9000-portini butun internetga ochmang.
Faqat asosiy serverning IP'siga ruxsat bering:

```bash
sudo ufw allow from <asosiy-server-ip> to any port 9000
sudo ufw deny 9000
```

### 2. Cloudflare R2

10 GB bepul, chiqish trafigi butunlay bepul. Serverlari chet elda —
shuning uchun shifrlash **majburiy** deb hisoblang.

### 3. Backblaze B2

10 GB bepul, keyin ~$6/TB oyiga. S3'ga mos API beradi.

## Sozlash

Asosiy serverning `.env` fayliga:

```bash
S3_BUCKET=goldmednova
S3_ENDPOINT=http://<ombor-ip>:9000      # MinIO uchun
S3_REGION=auto
S3_ACCESS_KEY_ID=<ombor kaliti>
S3_SECRET_ACCESS_KEY=<ombor maxfiy kaliti>
S3_FORCE_PATH_STYLE=true

# shifrlash kaliti — npm run secret:files bilan yarating
FILE_ENCRYPTION_KEY=<32 baytli base64>
```

Serverni qayta ishga tushiring. Jurnalda ko'rinishi kerak:

```
Fayllar  →  http://<ombor-ip>:9000 · goldmednova · shifrlangan
```

`shifrlangan` so'zi yo'q bo'lsa — `FILE_ENCRYPTION_KEY` o'qilmadi,
to'xtang va tekshiring.

## Tekshirish

```bash
CHECK_URL=https://sizning-saytingiz CHECK_PASS='parolingiz' \
  npm run security:check
```

`8b. Hujjatlar maxfiyligi` bo'limi shuni sinaydi: shartnoma tokensiz
ochilmaydi, admin ocha oladi, kuzatuvchi ocha olmaydi, uskuna rasmi esa
QR uchun ochiq qoladi.

Qo'lda ham sinang — ombor serveriga kirib, faylni oching:

```bash
head -c 16 /mnt/ombor/goldmednova/<biror-fayl>
```

`GMN1` degan belgidan keyin tasodifiy baytlar bo'lishi kerak. Shartnoma
matni ko'rinsa — shifrlash ishlamayapti.

## Kalit haqida

`FILE_ENCRYPTION_KEY` **faqat asosiy serverda** turadi.

* Uni ombor serveriga qo'ymang — bu butun himoyani bekor qiladi.
* Zaxira nusxasini parolingiz bilan bir joyda, xavfsiz saqlang.
* **Kalit yo'qolsa fayllarni hech kim ocha olmaydi** — na siz, na men.
  Baza saqlanib qoladi, lekin rasmlar va shartnomalar butunlay yo'qoladi.
* Kalitni almashtirsangiz, eski fayllar ochilmay qoladi. Almashtirish
  kerak bo'lsa, avval hamma faylni eski kalit bilan yuklab oling.

## Ko'chirish

Fayllar allaqachon diskda bo'lsa va ombor serveriga ko'chirmoqchi
bo'lsangiz, ayting — ko'chirish skriptini yozib beraman. Hozircha
avtomatik ko'chirish yo'q: yangi sozlama faqat **yangi** fayllarga
ta'sir qiladi, eskilari diskda qolaveradi.
