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

## Ishga tushirish

### 1. Kalitlar

`.env` faylida ikkita majburiy narsa bor — **Telegram token** (@BotFather dan)
va **DeepSeek kaliti** ([platform.deepseek.com](https://platform.deepseek.com)).
Ikkalasi ham to'ldirilgan bo'lsa keyingi qadamga o'ting.

Yangidan sozlash kerak bo'lsa:

```bash
cd bot
cp .env.example .env
nano .env
```

### 2. Ovozli xabar uchun kalit

DeepSeek'da ovozni matnga o'giradigan xizmat **yo'q**, shuning uchun bunga
alohida kalit kerak. Ikkitasidan **bittasi** yetarli:

* **OpenAI Whisper** — [platform.openai.com](https://platform.openai.com/api-keys) →
  `OPENAI_API_KEY`. O'zbek tilini yaxshi tushunadi, daqiqasi ~0.006 $.
* **Deepgram** — [console.deepgram.com](https://console.deepgram.com) →
  `DEEPGRAM_API_KEY`. Tezroq, bepul boshlang'ich krediti bor.

Kalit qo'shmasangiz bot ishlayveradi — faqat ovoz kelganda «yozib yuboring»
deb javob beradi. **Yozma xabarlar to'liq ishlaydi.**

### 3. O'rnatish va tekshirish

```bash
npm install
npm run tekshir
```

`tekshir` har bir xizmatni alohida sinaydi va nima ishlayotganini aytadi:

```
✅ .env o'qildi
✅ OWNER_ID: 123456789
✅ Baza yoziladi: .../bot/data/daftar.json
✅ Telegram: @sizning_botingiz
✅ deepseek javob berdi: "ha"
✅ Ovoz xizmati (openai) kalitni qabul qildi

✅ Hammasi joyida. "npm start" bilan ishga tushiring.
```

### 4. Ishga tushirish

```bash
npm start
```

### 5. OWNER_ID ni qo'yish (birinchi marta)

Telegramda botingizga **`/id`** deb yozing. U sizga raqamingizni aytadi.
Shu raqamni `.env` dagi `OWNER_ID` ga qo'ying va botni qayta ishga tushiring
(`Ctrl+C`, keyin `npm start`).

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

Noutbukda `npm start` qilib qo'ysangiz, noutbuk o'chsa bot ham to'xtaydi.
Doimiy ishlashi uchun arzon VPS (oyiga 3-5 $) oling va `systemd` ga bering:

```bash
sudo nano /etc/systemd/system/daftar-bot.service
```

```ini
[Unit]
Description=Daftar bot
After=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now daftar-bot
sudo systemctl status daftar-bot     # holatini ko'rish
journalctl -u daftar-bot -f          # loglarni kuzatish
```

`Restart=always` — bot qandaydir sababga ko'ra to'xtasa, 10 soniyada o'zi
qayta ishga tushadi.

> **Muhim:** botni bir vaqtda ikki joyda ishga tushirmang. Telegram bunga
> ruxsat bermaydi va log'da `409` xatosi chiqadi.

---

## Sozlamalar (`.env`)

| Kalit | Sukut | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Majburiy |
| `DEEPSEEK_API_KEY` | — | Majburiy (yoki `ANTHROPIC_API_KEY`) |
| `OWNER_ID` | — | Faqat shu odam foydalana oladi |
| `OPENAI_API_KEY` | — | Ovoz uchun (yoki `DEEPGRAM_API_KEY`) |
| `LLM_XIZMATI` | avtomatik | `deepseek` yoki `claude` |
| `LLM_MODEL` | `deepseek-chat` | Claude uchun: `claude-opus-5` |
| `TIMEZONE` | `Asia/Tashkent` | Sanalar shu mintaqada hisoblanadi |
| `ESLATMA_SOATI` | `9` | Kunlik eslatma soati (0-23) |
| `TASDIQ_DAQIQA` | `10` | Ovoz yozuvi qancha kutadi |
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

## Sinov

```bash
npm test       # 51 ta sinov — tarmoqqa ulanmasdan ishlaydi
npm run tekshir # jonli xizmatlarni tekshiradi
npm run check  # hamma fayl sintaksisi
```

Sinovlar sana hisobi, baza, vositalar, Excel yozuvchi, eslatma mantiqi,
tasdiqlash oqimi, DeepSeek so'rov/javob shakli va agent siklini qamrab oladi.

---

## Muammo bo'lsa

Avval **`npm run tekshir`** ishlating — ko'pincha sababni o'zi aytadi.

| Belgi | Sabab va yechim |
|---|---|
| `.env fayli to'liq emas` | `.env` da token yoki kalit yo'q |
| `409` xatosi log'da | Bot ikki joyda ishlayapti — eskisini to'xtating |
| Bot javob bermaydi | `OWNER_ID` noto'g'ri. `/id` yozib tekshiring |
| `DEEPSEEK_API_KEY noto'g'ri` | Kalit bekor qilingan yoki xato ko'chirilgan |
| `DeepSeek balansi tugagan` | platform.deepseek.com da hisobni to'ldiring |
| `Host not in allowlist` | Serveringiz tarmog'i o'sha manzilni bloklayapti |
| Ovoz «o'girib bo'lmadi» | `OPENAI_API_KEY` yo'q yoki balansi tugagan |
| Eslatma kelmayapti | `OWNER_ID` bo'sh bo'lsa eslatma ishlamaydi |
| Ism noto'g'ri yozilgan | Tasdiq xabariga «ismi Sardorbek» deb javob yozing |

---

## Ichki tuzilishi

```
bot/
├── src/
│   ├── index.js      — kirish nuqtasi, Telegram xabarlari va tugmalar
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
├── test/
│   ├── smoke.js      — 51 ta sinov
│   └── tekshir.js    — jonli diagnostika
└── data/daftar.json  — sizning ma'lumotlaringiz
```

Bog'liqliklar atigi ikkita: `@anthropic-ai/sdk` (Claude uchun) va `dotenv`.
DeepSeek to'g'ridan-to'g'ri `fetch` orqali ishlaydi. Qolgani — Node'ning o'zi.
