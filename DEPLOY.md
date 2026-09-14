# Saytni serverga joylash

Eng muhim savol — **kiritgan ma'lumotlaringiz qayerda saqlanadi.**

Bepul hostlarning aksariyati konteynerni o'chirib-yoqib turadi va diskdagi
hamma narsa yo'qoladi. Shuning uchun sayt ikki xil ishlay oladi:

| Variant | Ma'lumot qayerda | Karta | Fayl hajmi |
|---|---|---|---|
| **A. Neon Postgres** | tashqi bazada | kerak emas | 10 MB gacha |
| **B. Fly.io disk** | serverning o'z diskida | kerak | 50 MB gacha |

Ikkalasi ham sinovdan o'tgan: serverni o'chirib, diskni butunlay
o'chirib tashlab, qaytadan yoqqanda ham uskunalar, so'rovlar va
yuklangan fayllar joyida qoldi.

---

## A. Kartasiz: Neon + istalgan bepul host

Ma'lumot Neon'da (bepul Postgres) yotadi, host esa faqat saytni
ko'rsatadi. Host o'chib yonsa ham baza tegilmaydi.

### 1. Neon'da baza oching

1. [neon.tech](https://neon.tech) → GitHub bilan kiring (karta so'ralmaydi).
2. **Create project** → nom: `goldmednova`, region: Frankfurt.
3. **Connection string** ni nusxa oling. Shunga o'xshash bo'ladi:

   ```
   postgresql://neondb_owner:XXXX@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

Bepul reja: 0.5 GB. Bu reyestr uchun juda yetarli.

### 2. Maxfiy kalit yarating

```bash
npm run secret
```

### 3. Hostga joylashtiring

**Koyeb** ([koyeb.com](https://koyeb.com), kartasiz):

1. **Create Service** → **GitHub** → `fayzullo0518/fayzullo0518`
2. Builder: **Dockerfile**
3. Health check path: `/api/health`
4. Environment variables:

   | Nom | Qiymat |
   |---|---|
   | `DATABASE_URL` | Neon bergan satr |
   | `JWT_SECRET` | `npm run secret` chiqargani |
   | `ADMIN_PASSWORD` | o'zingiznikini, 12+ belgi |
   | `NODE_ENV` | `production` |
   | `FORCE_HTTPS` | `false` |
   | `TRUST_PROXY` | `1` |

5. **Deploy**.

Xuddi shu o'zgaruvchilar bilan **Railway**, **Render** yoki boshqa
istalgan Docker'ni qo'llaydigan host ham ishlaydi — ma'lumot Neon'da
bo'lgani uchun hostning diski bor-yo'qligi endi ahamiyatsiz.

---

## B. Karta bilan: Fly.io + disk

Eng sodda yo'l — kod umuman o'zgarmaydi, fayllar 50 MB gacha.

```bash
# 1. flyctl
curl -L https://fly.io/install.sh | sh

# 2. kiring
fly auth login

# 3. loyiha papkasida (fly.toml allaqachon bor — uni saqlang)
fly launch --no-deploy

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
uyg'otadi. Disk to'xtagan paytda ham joyida turadi.

---

## Fayllarni arzonlashtirish

Uskuna rasmlari va shartnomalar diskning eng katta qismini egallaydi, disk
esa VPS'ning eng qimmat qismi. Ularni alohida arzon omborga chiqarish
mumkin — baza va sayt asosiy serverda qoladi.

To'liq yo'riqnoma: **[FAYL-OMBORI.md](FAYL-OMBORI.md)**

## C. O'z serveringiz (VPS)

`deploy/SERVERGA-JOYLASH.md` da nginx va systemd bilan to'liq yo'riqnoma.
`DATA_DIR` ni doimiy papkaga ko'rsating — boshqa hech narsa kerak emas.

---

## Joylagandan keyin

### 1. Ishlayotganini tekshiring

```bash
curl https://sizning-saytingiz/api/health
```

### 2. Qaysi saqlash usuli ishlayotganini ko'ring

Server jurnalining boshida yozilgan:

```
Ma'lumotlar → Postgres · postgresql://***@ep-xxx.neon.tech/neondb
Ma'lumotlar → disk · /data
```

Agar **`[diqqat] DATA_DIR ham, DATABASE_URL ham berilmagan`** degan
ogohlantirish chiqsa — to'xtang. Bu degani ma'lumotlaringiz keyingi
qayta ishga tushishda yo'qoladi.

### 3. Xavfsizlik testini yurgizing

```bash
CHECK_URL=https://sizning-saytingiz \
CHECK_PASS='sizning-admin-parolingiz' \
npm run security:check
```

53 ta tekshiruv o'tishi kerak. Bu test brute-force cheklovini ham
sinaydi, shuning uchun undan keyin 15 daqiqa o'zingiz ham kira
olmaysiz — bu normal.

### 4. Panelga kiring va parolni almashtiring

`https://sizning-saytingiz/dev`

`ADMIN_PASSWORD` bermagan bo'lsangiz, parol jurnalda bir marta chiqadi.

### 5. Ma'lumot haqiqatan saqlanayotganini o'zingiz sinang

Bitta uskuna qo'shing, keyin hostda **Restart** bosing. Uskuna joyida
qolsa — hammasi to'g'ri sozlangan.

---

## Nima qilmaslik kerak

* `.env` faylini git'ga qo'shmang.
* `JWT_SECRET` va `DATABASE_URL` ni hech kimga bermang.
* `TRUST_PROXY` ni proksisiz serverda `1` qilmang — bunda har kim
  o'z IP'sini soxtalashtirib rate limit'dan o'tib ketadi.
* **Render'ning bepul rejasiga `DATABASE_URL`siz joylamang** — u yerda
  disk yo'q, hamma narsa har safar o'chib ketadi. Biz shuning uchun
  undan voz kechdik.
