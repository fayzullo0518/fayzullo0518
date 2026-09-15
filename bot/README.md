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

## Ishga tushirish — 5 qadam

### 1. Telegram bot yarating

Telegramda [@BotFather](https://t.me/BotFather) ga yozing:

```
/newbot
```

Nom va username so'raydi. Oxirida sizga token beradi —
`8012345678:AAH...` ko'rinishida. Shuni saqlab qo'ying.

### 2. Anthropic kaliti oling

[console.anthropic.com](https://console.anthropic.com) → **API Keys** →
**Create Key**. `sk-ant-...` bilan boshlanadigan kalit chiqadi.

> Balansingizga oz miqdorda pul qo'yish kerak. Kunlik 20-30 xabar uchun
> oyiga taxminan 1-3 dollar ketadi (pastdagi «Xarajat» bo'limiga qarang).

### 3. Ovozli xabar uchun kalit (ixtiyoriy, lekin sizga kerak)

Claude audio faylni o'qiy olmaydi, shuning uchun ovoz avval matnga
o'giriladi. Ikkitasidan **bittasi** yetarli:

* **OpenAI Whisper** — [platform.openai.com](https://platform.openai.com/api-keys) →
  `OPENAI_API_KEY`. O'zbek tilini yaxshi tushunadi, daqiqasi ~0.006 $.
* **Deepgram** — [console.deepgram.com](https://console.deepgram.com) →
  `DEEPGRAM_API_KEY`. Tezroq, bepul boshlang'ich krediti bor.

Ikkalasi ham bo'lmasa bot ishlayveradi — faqat ovoz kelganda «yozib
yuboring» deb javob beradi.

### 4. Sozlang

```bash
cd bot
cp .env.example .env
nano .env          # yoki istalgan matn muharriri
```

`.env` ichini to'ldiring:

```ini
TELEGRAM_BOT_TOKEN=8012345678:AAH...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...          # ovoz uchun
OWNER_ID=                       # hozircha bo'sh qoldiring
```

### 5. Ishga tushiring

```bash
npm install
npm start
```

Terminalda shunday chiqadi:

```
✅ @sizning_botingiz ishga tushdi
   Baza:        /home/.../bot/data/daftar.json (0 yozuv)
   Model:       claude-opus-5 (effort: medium)
   Vaqt:        Asia/Tashkent, eslatma soat 9:00
   Ovoz:        openai
   Ega:         BELGILANMAGAN — botga /id yozing
```

Endi Telegramda botingizga **`/id`** deb yozing. U sizga raqamingizni
aytadi. Shu raqamni `.env` dagi `OWNER_ID` ga qo'ying va botni qayta ishga
tushiring (`Ctrl+C`, keyin `npm start`).

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
| `ANTHROPIC_API_KEY` | — | Majburiy |
| `OWNER_ID` | — | Faqat shu odam foydalana oladi |
| `OPENAI_API_KEY` | — | Ovoz uchun (yoki `DEEPGRAM_API_KEY`) |
| `CLAUDE_MODEL` | `claude-opus-5` | `claude-sonnet-5` — ~2.5 barobar arzon |
| `CLAUDE_EFFORT` | `medium` | `low` — tezroq va arzonroq |
| `TIMEZONE` | `Asia/Tashkent` | Sanalar shu mintaqada hisoblanadi |
| `ESLATMA_SOATI` | `9` | Kunlik eslatma soati (0-23) |
| `VALYUTA` | `UZS` | Valyuta aytilmaganda shu olinadi |

---

## Xarajat

Kuniga ~25 xabar bo'lganda, taxminiy oylik:

| Nima | Model | Oyiga |
|---|---|---|
| Matnli xabarlar | `claude-opus-5` | ~2-3 $ |
| Matnli xabarlar | `claude-sonnet-5` | ~1 $ |
| Ovozli xabarlar | Whisper | ~0.5 $ (kuniga 5 daqiqa ovoz) |

Tizim yo'riqnomasi keshlanadi (`cache_control`), shuning uchun takroriy
xabarlar arzonroq tushadi. Arzonlashtirish kerak bo'lsa `.env` da:

```ini
CLAUDE_MODEL=claude-sonnet-5
CLAUDE_EFFORT=low
```

---

## Sinov

```bash
npm test     # 38 ta sinov — tarmoqqa ulanmasdan ishlaydi
npm run check # hamma fayl sintaksisini tekshiradi
```

Sinovlar sana hisobi, baza, vositalar, Excel yozuvchi, eslatma mantiqi va
agent siklini (soxta Claude mijozi bilan) qamrab oladi.

---

## Muammo bo'lsa

| Belgi | Sabab va yechim |
|---|---|
| `.env fayli to'liq emas` | `.env` da token yoki kalit yo'q |
| `409` xatosi log'da | Bot ikki joyda ishlayapti — eskisini to'xtating |
| Bot javob bermaydi | `OWNER_ID` noto'g'ri. `/id` yozib tekshiring |
| `ANTHROPIC_API_KEY noto'g'ri` | Kalit eskirgan yoki balans tugagan |
| Ovoz «o'girib bo'lmadi» | `OPENAI_API_KEY` yo'q yoki balansi tugagan |
| Eslatma kelmayapti | `OWNER_ID` bo'sh bo'lsa eslatma ishlamaydi |
| Ism noto'g'ri yozilgan | Ovozda shunday bo'ladi — «ismi Sardor emas, Sardorbek» deb yozing, tuzatadi |

---

## Ichki tuzilishi

```
bot/
├── src/
│   ├── index.js      — kirish nuqtasi, Telegram xabarlarini qabul qilish
│   ├── agent.js      — Claude bilan vositalar sikli
│   ├── vositalar.js  — agent vositalari: yozish, qidirish, belgilash, hisobot
│   ├── store.js      — JSON baza (atomar yozuv, zaxira)
│   ├── telegram.js   — Telegram Bot API mijozi
│   ├── asr.js        — ovozni matnga o'girish
│   ├── hisobot.js    — Excel va oylik xulosa
│   ├── eslatma.js    — kunlik/oylik jadval
│   ├── xlsx.js       — kutubxonasiz .xlsx yozuvchi
│   ├── vaqt.js       — sana hisobi (Asia/Tashkent)
│   └── config.js     — .env o'qish va tekshirish
├── test/smoke.js     — 38 ta sinov
└── data/daftar.json  — sizning ma'lumotlaringiz
```

Bog'liqliklar atigi ikkita: `@anthropic-ai/sdk` va `dotenv`. Qolgani —
Node'ning o'z imkoniyatlari.
