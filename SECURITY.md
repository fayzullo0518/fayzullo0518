# Xavfsizlik

Bu hujjat saytda qanday himoya borligini va uni qanday tekshirishni
tushuntiradi.

## Tez tekshiruv

```bash
# 1-terminal: serverni toza baza bilan ishga tushiring
DATA_DIR=/tmp/gmn-test JWT_SECRET=$(npm run --silent secret) npm start

# 2-terminal: jurnalga chiqqan parolni oling va testni yuriting
CHECK_PASS='<jurnaldagi parol>' npm run security:check
```

53 ta tekshiruv o'tishi kerak. Bittasi yiqilsa — nima buzilganini va
buzg'unchi undan nima yutishini yozib beradi.

## Nima tuzatilgan

### 1. Kodning ichidagi ochiq parollar — **kritik**

Ilgari to'rtta hisob paroli `server/db.js` faylida ochiq yozilgan edi
(`fayzullodev`, `sonyun2026` va hokazo), o'sha parollar `README.md` va
`ISHGA-TUSHIRISH.txt` da ham takrorlangan edi. Repozitoriyni ko'rgan har
qanday odam super admin bo'lib kira olardi.

Endi kodda hech qanday parol yo'q:

* birinchi administrator `ADMIN_USERNAME` / `ADMIN_PASSWORD` dan olinadi;
* `ADMIN_PASSWORD` berilmasa — server tasodifiy parol yaratadi va uni
  faqat bir marta, ishga tushish jurnaliga chiqaradi;
* qolgan uchta hamkasb hisobi **parolsiz** yaratiladi — panelda parol
  berilmaguncha ular kira olmaydi;
* server yaratgan parol bilan kirilganda panelda "parolni almashtiring"
  ogohlantirishi chiqadi.

### 2. Super admin orqa eshigi — **kritik**

`readDb()` super admin yo'qolganini sezsa, uni **o'sha ochiq parol bilan**
qaytarib qo'yardi. Hisobni o'chirib tashlash ham yordam bermasdi. Endi
bunday tiklash yangi tasodifiy parol bilan bo'ladi.

### 3. Ma'lumotlarning yo'qolib ketishi — **yuqori**

Baza `server/data/db.json` faylida yotardi. Bepul bulut hostlarida disk
vaqtinchalik: konteyner har qayta ishga tushganda hamma narsa noldan
boshlanadi. Ya'ni kiritilgan uskunalar, so'rovlar va yuklangan
shartnomalar muntazam yo'qolib turardi.

Endi ikkita saqlash usuli bor va ikkalasi ham doimiy:

* `DATABASE_URL` berilsa — hammasi Postgres'da (holat hujjati ham,
  fayllar ham). Hostning diski bor-yo'qligi ahamiyatsiz.
* aks holda — `DATA_DIR` papkasida, ulangan diskda.

Ikkalasi ham sinovdan o'tgan: server o'chirilib, disk butunlay o'chirib
tashlanib, qaytadan yoqilganda uskunalar, so'rovlar va yuklangan fayl
baytma-bayt joyida qoldi. `SIGTERM` (har deploy'da yuboriladi) kelganda
server oxirgi o'zgarishni bazaga yozib ulguradi.

Hech biri berilmasa server ishga tushishda qizil ogohlantirish chiqaradi.

### 4. Baza yozuvining atomik emasligi — **yuqori**

`db.json` to'g'ridan-to'g'ri ustiga yozilardi. Yozish o'rtasida server
o'chsa, fayl yarim qolardi; keyingi ishga tushishda `readDb()` uni o'qiy
olmay **butun bazani qaytadan seed qilardi** — ya'ni hamma reyestr yo'qolib,
o'rniga o'sha ochiq parollar qaytardi.

Endi: vaqtinchalik faylga yoziladi → eskisi `.bak` ga ko'chiriladi →
keyin o'rniga qo'yiladi. `db.json` buzilsa `.bak` dan tiklanadi. Fayl
huquqi `0600`.

### 5. Yetishmayotgan rol tekshiruvlari — **yuqori**

Bu nuqtalarda faqat "kirgan bo'lsa bo'ldi" tekshiruvi bor edi, ya'ni
`viewer` (faqat ko'rish) hisobi ham ularga yeta olardi:

| Nuqta | Ilgari | Endi |
|---|---|---|
| `GET /api/admin/users` | har qanday hisob | superadmin, admin |
| `PATCH /api/admin/inquiries/:id` | har qanday hisob | superadmin, admin |
| `POST /api/admin/notifications/read` | har qanday hisob | superadmin, admin |
| `GET /api/admin/integration/scopes` | har qanday hisob | superadmin, admin |

Birinchisi eng muhimi: jamoa ro'yxatida hamkasblarning e-mail va telefon
raqamlari bor.

### 6. Token (JWT) mustahkamlangan — **o'rta**

* `algorithms: ['HS256']` qattiq belgilangan — boshqa (zaifroq) algoritm
  bilan yasalgan token qabul qilinmaydi;
* `issuer` va `audience` tekshiriladi;
* tokenga parol izi (`pwd`) yoziladi: **parol almashsa eski tokenlar
  darhol ishlamay qoladi**. Ilgari o'g'irlangan token parol
  almashtirilgandan keyin ham 12 soat amal qilardi;
* tokendagi rol emas, bazadagi rol ishlatiladi.

### 7. Parol hash'lash — **o'rta**

`scryptSync` → asinxron `crypto.scrypt`, `N` 16384 dan 32768 ga
ko'tarildi, parametrlar hash bilan birga saqlanadi (kelajakda oshirish
uchun). Sinxron variant har bir kirishda butun serverni ~100 ms
to'xtatib turardi — bu o'z-o'zidan DoS vektori edi.

Eski formatdagi hash'lar ham o'qiladi, ya'ni mavjud baza ishlayveradi.

### 8. Hisob nomini aniqlab olish — **past**

Login topilmasa parol umuman tekshirilmasdi, javob tezroq qaytardi —
shu farq orqali qaysi loginlar mavjudligini bilib olish mumkin edi. Endi
mavjud bo'lmagan login uchun ham xuddi shuncha hisob-kitob bajariladi.

### 9. Ochiq yozuv nuqtalari — **yuqori**

`POST /api/inquiries` (buyurtma formasi) faqat umumiy API cheklovi ostida
edi: bitta IP 15 daqiqada 1200 ta yozuv qo'sha olardi, har biri butun
bazani diskka qayta yozardi. Endi soatiga 8 ta.

Hamkor API'sining "requests" hisoblagichi ham har so'rovda butun bazani
diskka yozardi — endi 30 soniyada bir marta yoziladi.

### 10. Fayl yuklash — **o'rta**

Ilgari faqat fayl nomining kengaytmasi tekshirilardi. Endi rasm
fayllarining birinchi baytlari ham tekshiriladi (JPEG, PNG, GIF, BMP,
WebP, AVIF, HEIC imzolari) — `.jpg` deb nomlangan HTML yoki skript
saqlanmaydi. SVG umuman qabul qilinmaydi (u XSS uchun klassik vektor).

### 11. Xato javoblari — **o'rta**

Har qanday xato 500 qaytarardi — hajmi katta so'rov ham, CORS rad etishi
ham, noto'g'ri JSON ham. Endi to'g'ri kod qaytadi (413 / 400 / 403), va
ichki xabar hech qachon tashqariga chiqmaydi.

### 12. Parol siyosati

Kamida 12 belgi (ilgari 10), harf va raqam majburiy, ichida login nomi
bo'lmasligi kerak, kamida 5 xil belgi, ommabop parollar ro'yxati kengaydi.

## Ilgaridan bor va joyida bo'lgan himoya

Bularni tekshirdim, o'zgartirish kerak bo'lmadi:

* `helmet` bilan CSP, `frame-ancestors 'none'` (clickjacking yo'q),
  `nosniff`, HSTS (production'da), `X-Powered-By` o'chirilgan;
* CORS production'da faqat `ALLOWED_ORIGINS` ro'yxati bo'yicha;
* kirishda IP + login bo'yicha qulflash (6 xato → 15 daqiqa) va IP
  bo'yicha cheklov (15 daqiqada 12 urinish);
* prototype pollution'ga qarshi JSON reviver;
* API kalitlari faqat SHA-256 hash ko'rinishida saqlanadi, plaintext bir
  marta ko'rsatiladi, `timingSafeEqual` bilan solishtiriladi;
* yuklangan fayllar UUID nom oladi — asl nom yo'lga umuman ta'sir
  qilmaydi, shuning uchun path traversal mumkin emas;
* React JSX avtomatik ekranlaydi, `dangerouslySetInnerHTML` hech qayerda
  ishlatilmagan;
* admin panelga havola saytning hech bir joyida yo'q (`/adm1n`, `/dev`).

## Bilib qo'yish kerak bo'lgan narsalar

**QR orqali holat o'zgartirish ochiq.** `PATCH /api/qr/:assetId/status`
tokensiz ishlaydi — bu ataylab shunday: uskuna yonidagi stikerni skanerlagan
shifokor nosozlikni xabar qila olishi kerak. Ya'ni assetId'ni bilgan odam
uskunani "nosoz" deb belgilay oladi (10 daqiqada 40 marta chegara bilan).
Har o'zgarish jurnalga tushadi va panelga bildirishnoma keladi. Agar bu
sizga to'g'ri kelmasa, aytsangiz seriya raqami so'raladigan qilib qo'yaman.

**Token `localStorage` da saqlanadi.** XSS bo'lsa uni o'g'irlash mumkin.
Hozir XSS yo'q (React ekranlash + qattiq CSP + SVG taqiqlangan), shuning
uchun buni o'zgartirmadim; `httpOnly` cookie'ga o'tish CSRF himoyasini ham
talab qiladi.

**Ikki bosqichli tasdiqlash (2FA) yo'q.** Bazada `twoFactor` degan maydon
bor, lekin u hech narsa qilmaydi — faqat panelda ko'rsatiladi.

## Deploy'dan oldin

1. `JWT_SECRET` — `npm run secret` bilan yarating, hech qayerga
   yozmang, faqat serverning env sozlamasiga qo'ying.
2. `ADMIN_PASSWORD` — 12+ belgi, boshqa hech qayerda ishlatilmagan.
3. `NODE_ENV=production`.
4. `TRUST_PROXY=1` (proxy orqasida) — bu noto'g'ri bo'lsa rate limit
   ishlamaydi.
5. HTTPS. Render va Fly.io buni o'zi qiladi; o'sha holda
   `FORCE_HTTPS=false` qo'ying.
6. `DATA_DIR` — ulangan diskka ko'rsating, aks holda har deploy'da
   ma'lumotlar o'chadi.
7. `npm run security:check` — deploy qilingan manzilga qarshi ham
   yurgizsa bo'ladi: `CHECK_URL=https://sizning-saytingiz npm run security:check`
