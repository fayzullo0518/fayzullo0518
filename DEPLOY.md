# Saytni bepul serverga joylash

Uchta variant. Birinchisi eng oson, uchinchisi eng ishonchli.

Qaysi birini tanlamang, kerak bo'ladigan narsa bir xil:

| Sozlama | Qiymat |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `npm run secret` chiqargan satr (32+ belgi) |
| `ADMIN_PASSWORD` | o'zingiz o'ylab topgan parol, 12+ belgi |
| `FORCE_HTTPS` | `false` — TLS'ni platformaning o'zi hal qiladi |
| `TRUST_PROXY` | `1` |
| `HOST` | `0.0.0.0` |
| `DATA_DIR` | `/data` (disk ulangan bo'lsa) |

---

## 1. Render.com — eng oson

**Bir bosishda:**

https://render.com/deploy?repo=https://github.com/fayzullo0518/fayzullo0518

Yoki qo'lda:

1. [render.com](https://render.com) da ro'yxatdan o'ting (karta kerak emas).
2. **New → Blueprint** → GitHub hisobini ulang → shu repozitoriyni tanlang.
3. Render `render.yaml` ni o'qiydi va hamma sozlamani o'zi qo'yadi.
   `JWT_SECRET` avtomatik yaratiladi.
4. Faqat bittasini qo'lda yozasiz: **`ADMIN_PASSWORD`**.
5. **Apply** → 3-5 daqiqada `https://goldmednova.onrender.com` tayyor.

**Bepul rejaning ikkita cheklovi bor, ikkalasi ham muhim:**

* 15 daqiqa hech kim kirmasa server uxlaydi. Keyingi tashrifchi
  ~50 soniya kutadi. Sayt yo'qolmaydi, shunchaki sekin uyg'onadi.
* **Diski yo'q.** Har deploy'da va har uyg'onishda `db.json` nolga
  qaytadi — ya'ni qo'shgan uskunalaringiz, so'rovlar va yuklangan
  shartnomalar yo'qoladi.

Ya'ni Render bepul reja — **ko'rsatish uchun** yaxshi, haqiqiy reyestr
yuritish uchun emas. Reyestr kerak bo'lsa Render'da disk qo'shing
(oyiga $7 dan) yoki quyidagi Fly.io variantini oling.

---

## 2. Fly.io — bepul, lekin disk bilan

Ma'lumotlar saqlanib qoladi.

```bash
# 1. flyctl o'rnating
curl -L https://fly.io/install.sh | sh

# 2. kiring
fly auth login

# 3. loyiha papkasida
fly launch --no-deploy          # fly.toml allaqachon bor, uni saqlang

# 4. ma'lumotlar uchun disk
fly volumes create goldmednova_data --size 1 --region fra

# 5. maxfiy sozlamalar
fly secrets set \
  JWT_SECRET="$(npm run --silent secret)" \
  ADMIN_PASSWORD="sizning-kuchli-parolingiz"

# 6. joylash
fly deploy
```

Manzil: `https://goldmednova.fly.dev`

`auto_stop_machines = "stop"` yozilgani uchun hech kim kirmasa mashina
to'xtaydi va bepul limit ichida qoladi; birinchi so'rov uni ~2 soniyada
uyg'otadi.

---

## 3. O'z serveringiz (VPS)

`deploy/SERVERGA-JOYLASH.md` da nginx va systemd bilan to'liq yo'riqnoma
bor. Qisqacha:

```bash
git clone https://github.com/fayzullo0518/fayzullo0518.git goldmednova
cd goldmednova
npm run install:all
npm run build
cp .env.example .env      # va to'ldiring
npm start
```

Oldiga nginx qo'yiladi, sertifikat `certbot` bilan olinadi.

---

## Joylagandan keyin — majburiy uchta qadam

**1. Ishlayotganini tekshiring**

```bash
curl https://sizning-saytingiz/api/health
```

**2. Xavfsizlik testini haqiqiy manzilga qarshi yurgizing**

```bash
CHECK_URL=https://sizning-saytingiz \
CHECK_PASS='sizning-admin-parolingiz' \
npm run security:check
```

Hammasi o'tishi kerak. Bu test brute-force cheklovini ham sinaydi,
shuning uchun undan keyin 15 daqiqa o'zingiz ham kira olmaysiz — bu
normal.

**3. Panelga kiring va parolni almashtiring**

`https://sizning-saytingiz/dev`

`ADMIN_PASSWORD` bermagan bo'lsangiz, parol server jurnalida (Render:
**Logs** bo'limi; Fly: `fly logs`) bir marta chiqadi.

---

## Nima qilmaslik kerak

* `.env` faylini git'ga qo'shmang. `.gitignore` da bor, shundayligicha qolsin.
* `JWT_SECRET` ni hech kimga bermang va hech qayerga yozmang. U o'zgarsa
  hamma sessiya bekor bo'ladi (bu — zarar emas, himoya).
* Admin parolini xat, Telegram yoki hujjat orqali yubormang.
* `TRUST_PROXY` ni proxy'siz serverda `1` qilib qo'ymang — bunda har kim
  o'z IP'sini soxtalashtirib rate limit'dan o'tib ketadi.
