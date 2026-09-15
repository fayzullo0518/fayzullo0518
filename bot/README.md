# 📒 Daftar bot — shaxsiy hisob-kitob agenti

Telegramda ishlaydigan mustaqil bot. Unga **ovozli** yoki **yozma** xabar
yuborasiz, u o'zi tushunib daftariga yozib qo'yadi, qaytarish sanasi kelganda
eslatadi, so'raganingizda Excel hisobot beradi va har oy yakunini chiqaradi.

Bu bot ushbu ombordagi Gold Med Nova saytiga **hech qanday aloqasi yo'q** —
alohida papka, alohida baza, alohida ishga tushadi.

---

## Nima qila oladi

| Siz yozasiz / aytasiz | Bot nima qiladi |
|---|---|
| «Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to'laydi» | Yozuv ochadi: apparat + qarz, muddati 01.10.2026 |
| «Jasurga kardiograf vaqtincha berdim, 20 kundan keyin qaytaradi» | Ijara yozuvi, sanani o'zi hisoblaydi |
| «Akmalga 5 mln qarz berdim, oyning oxirida qaytaradi» | Pul qarzi yozuvi |
| «Nodirga monitor sotdim, 8 mln, pulini oldim» | Sotuv — darrov yopiq holatda |
| «Sardor qaytardi» | O'sha odamning ochiq yozuvini topib, qaytarildi deb belgilaydi |
| «Akmal 2 mln berdi» | Qisman to'lov — qoldiqni hisoblab turadi |
| «Yo'q, 5 mln emas 6 mln edi» | Yozuvni tuzatadi |
| «Excel ber» / `/excel` | 3 varaqli `.xlsx` yuboradi |
| «Sentabr qanday o'tdi?» / `/oy` | Oylik xulosa |

**Har kuni** belgilangan soatda muddati kelgan va kechikkanlarni eslatadi —
har biriga «✅ qaytardi» tugmasi bilan.
**Har oy boshida** o'tgan oy yakunini yuboradi: nima berildi, nima sotildi,
qaysilari qaytarildi, qaysilari qaytarilmadi.

---

## Ovozli xabar qanday ishlaydi

```
Siz  🎤  «Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha»
              ↓
Bot  🎤  Eshitganim:
         «Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha»
              ↓
Bot      Saqladim: Sardor — UZI apparati, 12 mln, 1-oktabrgacha.
              ↓
Bot  📝  Shu yozuv saqlandi:
            • Y0007 ⏳ • Sardor • UZI apparati • 12 000 000 UZS • 01.10.2026 gacha

         Noto'g'ri bo'lsa shu yerga tuzatib yozing.
         10 daqiqada javob bo'lmasa, to'g'ri deb saqlayman.
         [ ✅ To'g'ri ]  [ 🗑 Sardor o'chirilsin ]
```

* **Hech narsa qilmasangiz** — 10 daqiqadan keyin yozuv o'zi tasdiqlanadi,
  tugmalar yo'qoladi. ⏳ belgisi ham ketadi.
* **✅ To'g'ri** bossangiz — darrov tasdiqlanadi.
* **Tuzatib yozsangiz** («ismi Sardor emas, Sardorbek») — bot tuzatadi va
  tuzatilgan yozuv darrov tasdiqlangan hisoblanadi.
* **🗑** bossangiz — butunlay o'chadi, qaytadan aytasiz.

Yozma xabarlar darrov tasdiqlangan holda saqlanadi — tasdiq faqat ovoz uchun,
chunki xato aynan eshitishda bo'ladi.

Kutish muddatini `.env` dagi `TASDIQ_DAQIQA` orqali o'zgartirasiz.

---

## Tez boshlash — 3 buyruq

Telegram, VPS, bot tokeni — hech qaysi kerak emas. Faqat **DeepSeek kaliti**
va **Node.js 20+**. PowerShell'da ham, Mac/Linux terminalida ham bir xil.

```bash
npm install
npm run sozla     # kalitni so'raydi, .env ni o'zi yaratadi
npm run chat      # agent bilan terminalda gaplashasiz
```

`npm run chat` shunday ko'rinadi:

```
📒 Daftar — terminal rejimi   deepseek/deepseek-chat
   Bugun: 2026-09-15 (Seshanba) — 0 yozuv

> Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to'laydi
🤖 Saqladim: Sardor — UZI apparati, 12 000 000 so'm, 1-oktabrgacha.

> Akmalga besh million qarz berdim, oyning oxirida qaytaradi
🤖 Saqladim: Akmal — 5 000 000 so'm, 30-sentabrgacha.

> /royxat
📋 Qaytarilmaganlar — 2 ta
📆 Keyinroq (2)
   Y0002 • Akmal • 5 000 000 UZS • 30.09.2026 gacha
   Y0001 • Sardor • UZI apparati • 12 000 000 UZS • 01.10.2026 gacha

> /excel
   📊 2 qator saqlandi:
   C:\Users\siz\daftar-bot\bot\hisobotlar\daftar-2026-09-15.xlsx
```

Bir xil daftar, bir xil vositalar, bir xil yozuvlar — keyin Telegramga
o'tsangiz, hamma yozuvlaringiz joyida turadi.

> **Windows'da:** loyihani `C:\WINDOWS\System32` ichiga klonlamang.
> PowerShell'ni **administrator sifatida emas**, oddiy holda oching —
> u `C:\Users\ismingiz` dan boshlanadi, o'sha yerda klonlang.

---

## Telegram boti sifatida ishga tushirish

Terminalda sinab ko'rgach, botga o'tish oson.

### 1. Telegram tokeni

[@BotFather](https://t.me/BotFather) ga `/newbot` yozing. Nom va username
so'raydi, oxirida token beradi.

```bash
npm run sozla     # endi Telegram tokenini ham kiritasiz
```

### 2. Ovozli xabar uchun kalit (ixtiyoriy)

Na DeepSeek, na Claude audio faylni o'qiy oladi — ovoz avval matnga
o'girilishi kerak. Shunga alohida kalit kerak, uchtasidan **bittasi**:

| Xizmat | Narxi | Olish |
|---|---|---|
| **Groq** | bepul limiti bor, `whisper-large-v3` | [console.groq.com](https://console.groq.com) |
| OpenAI Whisper | ~0.006 $/daqiqa | [platform.openai.com](https://platform.openai.com/api-keys) |
| Deepgram | bepul boshlang'ich krediti | [console.deepgram.com](https://console.deepgram.com) |

**Groq'dan boshlash ma'qul** — bepul limiti bor va karta talab qilmaydi.
Kalit `gsk_` bilan boshlanadi.

```bash
npm run sozla     # "Ovozli xabar uchun kalit" savoliga qo'ying
```

Usta kalitni prefiksidan tanib, to'g'ri joyga yozadi: `gsk_` → Groq,
`sk-` → OpenAI.

Kalit qo'shmasangiz bot ishlayveradi — faqat ovoz kelganda «yozib yuboring»
deb javob beradi. **Yozma xabarlar to'liq ishlaydi.**

### 3. Tekshirish va ishga tushirish

```bash
npm run tekshir   # har bir xizmatni alohida sinaydi
npm start
```

### 4. OWNER_ID ni qo'yish

Telegramda botingizga **`/id`** deb yozing. U raqamingizni aytadi:

```bash
npm run sozla     # OWNER_ID ga shu raqamni kiriting
npm start
```

**Tayyor.** Endi istalgan narsani yozib yoki aytib yuboring.

> `OWNER_ID` — himoya chorasi: botni tasodifan topgan begona odam undan
> foydalana olmaydi, sizning ma'lumotlaringizni ko'ra olmaydi.

---

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `/royxat` | Qaytarilmaganlar — kechikkan / bugun / keyinroq bo'yicha |
| `/excel` | Excel fayl: Hammasi, Qaytarilmagan, Qaytarilgan varaqlari |
| `/oy` | Shu oy hisoboti |
| `/otganoy` | O'tgan oy hisoboti |
| `/bekor` | Suhbat tarixini tozalaydi (yozuvlarga tegmaydi) |
| `/id` | Telegram ID ni ko'rsatadi |
| `/yordam` | Qisqacha qo'llanma |

Buyruqlarni eslab o'tirish shart emas — «excel ber», «sentabrda nima
bo'ldi», «kim qarzdor» deb oddiy yozsangiz ham tushunadi.

---

## Ma'lumot qayerda saqlanadi

Hammasi **`bot/data/daftar.json`** faylida — sizning kompyuteringizda yoki
serveringizda. Hech qayerga yuborilmaydi.

* Har o'zgarishda darrov diskka yoziladi (avval `.tmp`, keyin almashtiriladi —
  elektr o'chsa ham fayl buzilmaydi).
* Oldingi nusxa `daftar.json.bak` da turadi.
* Fayl buzilib qolsa bot uni chetga suradi va toza bazadan davom etadi,
  yiqilmaydi.

**Zaxira nusxa:** vaqti-vaqti bilan shu faylni nusxalab qo'ying:

```bash
cp bot/data/daftar.json ~/daftar-zaxira-$(date +%F).json
```

---

## Doimiy ishlab turishi uchun (24/7)

Noutbukda `npm start` qilsangiz, noutbuk o'chishi bilan bot ham to'xtaydi.
Doimiy ishlashi uchun arzon VPS (oyiga $4-6) kerak.

**To'liq qo'llanma: [VPS.md](VPS.md)** — server sotib olishdan to bot o'zi
qayta ishga tushadigan holatgacha, har bir buyruq izohi bilan. Linux
bilmasangiz ham bo'ladi.

Qisqacha: serverda kodni klonlab, `.env` ni to'ldirgach:

```bash
sudo bash deploy/ornatish.sh
```

Skript Node versiyasini va `.env` ni tekshiradi, `systemd` xizmatini
yaratadi va ishga tushiradi. Shundan keyin bot server qayta yuklansa ham
o'zi yonadi, qulasa ham 10 soniyada tiklanadi.

```bash
sudo systemctl status daftar-bot     # holati
sudo systemctl restart daftar-bot    # qayta ishga tushirish
journalctl -u daftar-bot -f          # loglar
```

**Zaxira nusxa** — `deploy/zaxira.sh` ni cron'ga qo'ying:

```cron
0 3 * * * /home/daftar/daftar-bot/bot/deploy/zaxira.sh
```

Har kuni soat 3:00 da nusxa oladi, 30 kunlik tarix saqlaydi.

> **Muhim:** botni bir vaqtda ikki joyda ishga tushirmang. Telegram bunga
> ruxsat bermaydi va log'da `409` xatosi chiqadi.

---

## Sozlamalar (`.env`)

| Kalit | Sukut | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Majburiy |
| `DEEPSEEK_API_KEY` | — | Majburiy (yoki `ANTHROPIC_API_KEY`) |
| `OWNER_ID` | — | Faqat shu odam foydalana oladi |
| `GROQ_API_KEY` | — | Ovoz uchun, bepul limiti bor |
| `OPENAI_API_KEY` | — | Ovoz uchun, pullik |
| `ASR_MODEL` | xizmatga qarab | Ovoz modeli (odatda tegish shart emas) |
| `LLM_XIZMATI` | avtomatik | `deepseek` yoki `claude` |
| `LLM_MODEL` | `deepseek-chat` | Claude uchun: `claude-opus-5` |
| `TIMEZONE` | `Asia/Tashkent` | Sanalar shu mintaqada hisoblanadi |
| `ESLATMA_SOATI` | `9` | Kunlik eslatma soati (0-23) |
| `TASDIQ_DAQIQA` | `10` | Ovoz yozuvi qancha kutadi |
| `TEKSHIRUV_SONIYA` | `60` | Eslatma/tasdiq jadvali qancha tez tekshiriladi |
| `TELEGRAM_ASOS` | rasmiy | Sinov uchun boshqa manzil |
| `BAZA_YOLI` | `data/daftar.json` | Baza fayli qayerda tursin |
| `VALYUTA` | `UZS` | Valyuta aytilmaganda shu olinadi |

### Claude'ga o'tish

Kod ikkala xizmatni ham biladi. Almashtirish uchun `.env` da:

```ini
LLM_XIZMATI=claude
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-5
```

Claude qimmatroq, lekin o'zbek tilini va sana hisobini aniqroq tushunadi.
DeepSeek ancha arzon. Ikkalasini sinab, o'zingizga qulayini tanlang.

---

## Xarajat

Kuniga ~25 xabar bo'lganda, taxminiy oylik:

| Nima | Xizmat | Oyiga |
|---|---|---|
| Matnli xabarlar | DeepSeek | ~0.2-0.4 $ |
| Matnli xabarlar | Claude Opus 5 | ~2-3 $ |
| Ovozli xabarlar | Whisper | ~0.5 $ (kuniga 5 daqiqa ovoz) |

---

## Sinov va demo

```bash
npm run sozla     # .env ni savol-javob bilan yaratish
npm run chat      # terminalda agent bilan gaplashish
npm run webhook-ochir # 409 xatosi: webhook ni olib tashlash
npm run holat     # qaysi kod, qayerda, nechta nusxa ishlayapti
npm run tekshir   # token, kalit, ovoz xizmati — hammasi ishlayaptimi?
npm run llm-sinov # model o'zbek tilini qanchalik tushunadi?
npm run demo      # butun botni soxta Telegram bilan ishlatib ko'rsatadi
npm test          # 55 ta sinov — tarmoqqa ulanmasdan
npm run check     # hamma fayl sintaksisi
```

### `npm run llm-sinov`

`.env` dagi model bilan **haqiqiy** so'rov yuboradi va o'zbekcha gaplarni
qanchalik to'g'ri tushunishini o'lchaydi — ismni, summani, sanani, yozuv
turini. Telegram kerak emas, faqat model kaliti. Bir marta ishlatish
DeepSeek'da bir tiyindan ham arzon.

```
🧪 Til modeli sinovi — deepseek / deepseek-chat

  1/6  👤 "Sardorga UZI apparati berdim, 12 mln, 1-oktabrgacha to'laydi"
       apparat + qarz, "12 mln", "1-oktabrgacha"
       ✅ Sardor — apparat_qarz — 12 000 000 UZS — 01.10.2026

  2/6  👤 "Akmalga besh million qarz berdim, o'ttiz sentabrda qaytaradi"
       summa so'z bilan: "besh million", sana "o'ttiz sentabrda"
       ✅ Akmal — pul_qarz — 5 000 000 UZS — 30.09.2026
  …
  6/6 to'g'ri (100%) — deepseek/deepseek-chat
```

Xato chiqsa qaysi maydon noto'g'ri tushunilganini aniq ko'rsatadi:

```
       ❌ summa: kutilgan 12 000 000, keldi 12 000
```

**Ikki modelni solishtirish:** `.env` da `LLM_XIZMATI=claude` qilib yana
ishlating. Natijani taqqoslab, qaysi biri sizning gapirish uslubingizni
yaxshiroq tushunishini ko'rasiz.

### `npm run demo`

Haqiqiy botni (`src/index.js`) ishga tushiradi, lekin Telegram, DeepSeek va
ovoz xizmatlari o'rniga mahalliy soxta server turadi. Internet ham, pul ham
ketmaydi. Bir daqiqada butun oqimni ko'rasiz:

```
── 4. Ovozli xabar — eshitgani qaytarildi va tasdiq so'raldi ─
  🤖 🎤 Eshitganim:
     Akmalga besh million qarz berdim o'ttiz sentabrda qaytaradi
  🤖 Saqladim: Akmal — 5 000 000 so'm, 30-sentabrgacha.
  🤖 📝 Shu yozuv saqlandi:
        • Y0003 ⏳ • Akmal • 5 000 000 UZS • 30.09.2026 gacha
     [ ✅ To'g'ri ]  [ 🗑 Akmal o'chirilsin ]
```

Demoda ko'rsatiladi: eslatma va «qaytardi» tugmasi, yozma xabar, ovozli
xabar + tasdiq, jim qolinganda o'zi tasdiqlanishi, `/royxat`, `/excel`.

Sinovlar esa sana hisobi, baza, vositalar, Excel yozuvchi, eslatma mantiqi,
tasdiqlash oqimi, DeepSeek so'rov/javob shakli va agent siklini qamrab oladi.

---

## Muammo bo'lsa

Avval **`npm run tekshir`** ishlating — ko'pincha sababni o'zi aytadi.

| Belgi | Sabab va yechim |
|---|---|
| `.env fayli to'liq emas` | `.env` da token yoki kalit yo'q |
| `409` xatosi | Ikki sabab bor: bot ikki joyda ishlayapti, yoki webhook o'rnatilgan. `npm run tekshir` qaysi biri ekanini aytadi; webhook bo'lsa `npm run webhook-ochir` |
| Bot javob bermaydi | `OWNER_ID` noto'g'ri. `/id` yozib tekshiring |
| `DEEPSEEK_API_KEY noto'g'ri` | Kalit bekor qilingan yoki xato ko'chirilgan |
| `DeepSeek balansi tugagan` | platform.deepseek.com da hisobni to'ldiring |
| `Host not in allowlist` | Serveringiz tarmog'i o'sha manzilni bloklayapti |
| «Balansi tugagan» | Ovoz xizmatining hisobi bo'sh. Bepul muqobil: `console.groq.com` dan `gsk_` kalit olib, `npm run sozla` |
| Ovoz «o'girib bo'lmadi» | Ovoz kaliti yo'q yoki noto'g'ri. `npm run tekshir` aniq aytadi |
| Eslatma kelmayapti | `OWNER_ID` bo'sh bo'lsa eslatma ishlamaydi |
| Ism noto'g'ri yozilgan | Tasdiq xabariga «ismi Sardorbek» deb javob yozing |

---

## Ichki tuzilishi

```
bot/
├── src/
│   ├── index.js      — Telegram boti: xabarlar va tugmalar
│   ├── chat.js       — terminal rejimi (Telegramsiz)
│   ├── sozla.js      — .env yaratish ustasi
│   ├── agent.js      — vositalar sikli (modeldan mustaqil)
│   ├── miya.js       — DeepSeek / Claude qatlami
│   ├── vositalar.js  — agent vositalari: yozish, qidirish, belgilash, hisobot
│   ├── store.js      — JSON baza (atomar yozuv, zaxira, tasdiq holati)
│   ├── telegram.js   — Telegram Bot API mijozi
│   ├── asr.js        — ovozni matnga o'girish
│   ├── hisobot.js    — Excel va oylik xulosa
│   ├── eslatma.js    — kunlik/oylik jadval + tasdiq muddati
│   ├── xlsx.js       — kutubxonasiz .xlsx yozuvchi
│   ├── vaqt.js       — sana hisobi (Asia/Tashkent)
│   └── config.js     — .env o'qish va tekshirish
├── deploy/
│   ├── ornatish.sh   — systemd xizmatini yaratadi
│   └── zaxira.sh     — kunlik zaxira nusxa
├── test/
│   ├── smoke.js      — 55 ta sinov
│   ├── demo.js       — soxta Telegram bilan to'liq ishga tushirish
│   ├── llm-sinov.js  — model o'zbek tilini qanday tushunishi
│   └── tekshir.js    — jonli diagnostika
├── VPS.md           — serverga o'rnatish qo'llanmasi
└── data/daftar.json  — sizning ma'lumotlaringiz
```

Bog'liqliklar atigi ikkita: `@anthropic-ai/sdk` (Claude uchun) va `dotenv`.
DeepSeek to'g'ridan-to'g'ri `fetch` orqali ishlaydi. Qolgani — Node'ning o'zi.
