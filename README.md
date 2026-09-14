# Gold Med Nova — medical devices marketplace

A full-stack marketplace for the **Gold Med Nova** medical equipment brand, in
**Uzbek, Russian and English**: a scroll-driven landing page, a market of 233 devices across
twelve catalogues, a device page with a contact button, an editable contact page, private
service manuals reachable by QR code, and an administrator dashboard. Backed by an
Express + JSON-file API.

Catalogue content (models, specifications and product photography) was extracted from
`katalg.pdf` — the Gold Med Nova medical devices catalogue that sits next to this folder.

---

## Run it

```bash
npm run install:all
```

```bash
npm run dev
```

* client (Vite) → <http://localhost:5173>
* API (Express) → <http://localhost:5175/api/health>

The Vite dev server proxies `/api` and `/uploads` to the Express server, so only the client
URL is needed.

### Production

```bash
npm run build && npm start
```

`npm start` serves the built client and the API together from <http://localhost:5175>.

---

## Languages

Uzbek (default), Russian and English. The switcher sits in the header (globe icon), in the
dashboard top bar and on the sign-in page; the choice is remembered. On a first visit the
site follows the browser language. Device models and technical specifications stay in their
catalogue form — only the interface is translated.

---

## Sign in

The dashboard is **unlisted**. Nothing on the public site links to it — not the header, not
the footer, not the mobile sheet. It lives at one address:

```
/dev        (or /adm1n — both work)
```

Typing either address shows the sign-in card; `/admin` and `/login` redirect to
the home page.

**No password is stored in this repository.** The first administrator comes
from the environment:

```bash
ADMIN_USERNAME=fayzullo
ADMIN_PASSWORD=<at least 12 characters>
```

Leave `ADMIN_PASSWORD` empty and the server generates one at first boot and
prints it to its log **once** — copy it from there, sign in, and change it.
The panel shows a warning banner until you do.

| Role        | Username   | Password                      | Can do                                                    |
| ----------- | ---------- | ----------------------------- | --------------------------------------------------------- |
| Super admin | `fayzullo` | from `ADMIN_PASSWORD`         | Everything, **including appointing other administrators** |
| Admin       | `SonYun`   | none — set it from the panel  | Catalogues, devices, manuals, contact page, requests       |
| Manager     | `dilnoza`  | none — set it from the panel  | Read-only dashboard                                        |
| Viewer      | `otabek`   | none — set it from the panel  | Read-only dashboard                                        |

The three colleague accounts are seeded **without a credential**, so nobody
can sign in as them until the super admin sets a password from Team. Set
`SEED_TEAM=0` to leave them out altogether.

See [SECURITY.md](SECURITY.md) for the full picture and `npm run security:check`
to verify it.

## Where the data is kept

The register is only useful if what you type into it is still there tomorrow.
Two backends, picked by the environment:

| Set this | Data lives in | Uploads up to |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (Neon's free tier needs no card) | 10 MB |
| `DATA_DIR` | that folder — put a volume on it | 50 MB |

With `DATABASE_URL` the host itself can be completely disposable, which is
what free tiers are. Set neither and the server prints a warning at boot,
because on a cloud host that means everything is lost on the next restart.

See [DEPLOY.md](DEPLOY.md).

The API enforces this, not just the UI: `requireRole('superadmin')` guards team management,
`requireRole('superadmin', 'admin')` guards catalogues, devices, manuals, uploads and the
contact page.

---

## Pages

| Route                 | What it is                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `/`                   | Hero + scroll experience, catalogues, one featured device per catalogue, how-it-works, contact CTA |
| `/market`             | Every device — search, catalogue filter, sort, progressive loading             |
| `/product/:id`        | Device page — gallery, full specification, **contact button**, service manual (when attached), related devices |
| `/contact`            | Ordering page — administrators, Instagram/Telegram/e-mail with QR codes, request form |
| `/contact/:id`        | Same page with a device attached                                               |
| `/manual/:id`         | **Service manual — unlisted.** Only reachable through its printed QR code, or from a device it is attached to |
| `/q/:assetId`         | **What a printed QR code opens** — three buttons: how to use it, device details (name, model, serial, condition — the visitor may change the condition), contact the operator |
| `/adm1n`              | **The only way into the panel.** Unlisted — nothing on the public site links here. Shows the sign-in card, then the dashboard. `/admin` and `/login` redirect to `/` |

Ordering flow: **market card → device page (information) → contact button → contact page**.

---

## Header and menu

* **Header** — floats transparently over the hero and turns into a solid blurred bar once
  the page scrolls, at which point the dark "order" pill slides in. Centre navigation with a
  catalogue mega-dropdown (icon, name, tagline per catalogue), language menu, theme toggle,
  and a full-screen menu sheet on smaller screens. There is deliberately **no sign-in link** —
  the dashboard is reached only by typing `/adm1n`.
* **Dashboard sidebar** — a slim icon rail plus an expandable panel. Catalogues, Products,
  Requests and Monitoring expand with `+`/`−` into nested filters that drive the table next to
  them; the
  active branch is marked with a dot. The avatar at the bottom of the rail opens a profile
  popup with keyboard hints, and a "new requests" card sits at the foot of the panel.

---

## Adding catalogues and devices

1. Sign in and open **Catalogues** → **New catalogue** (name, tagline, description, accent
   colour). It appears on the home page, in the market rail and in the header dropdown at once.
2. **Products** → **Add device** (or press `+` on a catalogue card to start in that catalogue).
3. Fill in model, name, catalogue, type, summary, availability, lead time and warranty.
   **Upload photo** stores the image on the server and links it; you can also paste an image
   URL. Without a photo the device shows a neutral placeholder.
4. Fill in the **standard technical sheet**. Its fourteen rows are the same for every device
   in the catalogue — manufacturer, country, type, power, consumption, dimensions, weight,
   display, throughput, operating conditions, software, standards, warranty term, what is
   included — so the product page reads identically from one device to the next; only the
   values differ. Anything this device needs beyond the template goes under **device-specific
   parameters** as free label/value rows.

   On the page the sheet sits **under the device**. On a phone only the photograph, the name
   and the four headline rows show, with the rest behind **“Ko‘proq ma’lumot”**.
5. Clicking any row in the products table opens a **quick-look window** with the photo, the
   facts and the full specification, plus open / edit / delete.

A device page only ever shows **its own photograph** — no other device's image is used to pad
the gallery. Extra photos can be added per device and then appear as thumbnails.

Devices imported from the PDF can be edited too — the edit is stored as an override and the
original data is never overwritten. Removing an imported device hides it from the market;
removing one you created deletes it. A catalogue can only be deleted once it is empty, and
the twelve imported catalogues cannot be deleted at all.

---

## Purchase requests

**Requests** lists every enquiry sent from a contact page. Clicking a row opens the full
request: customer, phone, e-mail, region, quantity, the device it concerns and **the message
they wrote**, with one-tap call / e-mail and the status pills (new → contacted → quoted →
won / lost).

---

## Equipment monitoring (apparat monitoringi)

**Monitoring** is the register of machines that have actually been sold and installed — one
record per physical machine, separate from the catalogue entry it was bought from.

A record carries its photographs (as many as you like, 50 MB in total), a **three-level
classification** — field → group → device type, 15 / 67 / 326 entries — the manufacturer and
country, name, model and serial number, the UzASBO inventory number, the **contract and
invoice files**, the dates (manufactured, purchased, **warranty expiry, then date of sale**,
installed, service life), the funding source and price, the financially responsible person
and the operator, where it stands, and its **condition**.

**Districts.** Every district and city of Fergana region is in the list, plus
“Boshqa — qo‘lda kiritish” for a machine that stands outside it; the organisation name is
typed by hand.

**Condition.** Soz / Nosoz / Yaroqsiz. Choosing *nosoz* or *yaroqsiz* opens a separate window
that asks what is wrong — the record will not save without it.

**Location.** The coordinate inputs and the map are two views of one value: click the map and
the coordinates fill in, type coordinates and the marker moves there. Tiles come from
OpenStreetMap, which needs no API key. (Yandex serves tiles only to registered keys, so it is
not wired in; `MapPicker.jsx` has a `LAYERS` table to add one to.)

**Excel.** Two buttons: the whole register as `.xlsx` (with the classification on a second
sheet), and the classification tree on its own. Written by `server/xlsx.js` — a small ZIP +
SpreadsheetML writer, no third-party package.

---

## The printed QR code

Every monitoring record has its own QR code, shown once the record is saved. Scanning it
opens `/q/:assetId` — three buttons and nothing else:

1. **Qanday ishlatish** — the operating instruction attached to the machine.
2. **Apparat ma’lumotlari** — the photograph, name, model, serial number and condition, and
   nothing else: no price, no contract, no purchase history. The visitor **may change the
   condition**; marking it faulty requires a written reason.
3. **Operator bilan bog‘lanish** — the operator’s phone, then the usual channels.

A condition change writes to a notification feed. Every open dashboard polls it, so the change
reaches **all** signed-in administrators within seconds — as a badge on the bell, and as a
desktop notification where the browser allows it.

---

## Monitoring dashboard and device register

Two screens sit behind **Apparat monitoringi** and **Qurilmalar ro'yxati**.

**The dashboard** filters the fleet by region, district, organisation and all
three classification levels, then draws four headline counters (total, working,
needs repair, unusable), a table of the matching machines, a donut of the
condition split and a per-field breakdown. **Xaritani ko'rsatish** puts every
machine that has coordinates on one map, coloured by condition; clicking a dot
opens that record.

**The register** is the full table from the screenshots: quick filters for
serial, inventory number and the two dates, a collapsible panel of eleven more,
and a row menu offering **QR-kod / Ko'rish / O'zgarishlar tarixi / Tahrirlash**.
**Export** and **Hisobotni yuklab olish** appear only for administrators and
hand back the current filter as a five-sheet workbook.

---

## Change history

Every edit is diffed field by field and stored on the record: which field, what
it was, what it became, who did it and when. Condition changes made from a
printed QR code land in the same history, attributed to the person who scanned
it. Open it from the row menu or from the bottom of the view dialog.

---

## Regions

The whole country: 14 regions (12 viloyat, Karakalpakstan and Tashkent city),
205 districts and cities. Picking a region narrows the district list; a machine
outside the list uses "Boshqa — qo'lda kiritish". The organisation name is typed
by hand, with the names already used in that district offered as suggestions.

---

## Integration (`/api/v1`)

Another website connects with an API key minted from **Integratsiya**. The
plaintext is shown once and stored only as a SHA-256 hash; each key carries a
scope list and can be suspended or deleted at any time.

| Scope | What it opens |
| --- | --- |
| `catalog:read` | `/categories`, `/products`, `/products/:id` |
| `assets:read` | `/assets`, `/assets/summary` (no price or contract columns) |
| `manuals:read` | `/manuals/:id` |
| `inquiries:write` | `POST /inquiries` |

```bash
curl -H "X-API-Key: gmn_..." https://goldmednova.uz/api/v1/products?limit=20
```

Browser-side calls from a partner domain also need that origin in
`ALLOWED_ORIGINS`.

---

## Security

Set up for a public host, and enforced on the server rather than in the UI.

* **Headers** — helmet: CSP, HSTS, `nosniff`, `frame-ancestors: none`.
* **Passwords** — scrypt with a per-user salt; at least 10 characters with a
  letter and a digit, common choices rejected.
* **Sign-in** — six wrong guesses lock that username from that address for
  fifteen minutes; the error message never says which half was wrong.
* **Rate limits** — 1200 API calls / 15 min, 12 sign-ins / 15 min, 40 QR
  condition changes / 10 min, 240 uploads / hour, 600 partner calls / 15 min.
* **CORS** — same-origin unless `ALLOWED_ORIGINS` names the partner.
* **Bodies** — `__proto__`, `constructor` and `prototype` are stripped from
  every JSON body before it reaches a store.
* **Uploads** — extension allow-list, 50 MB ceiling, UUID filenames, served
  with `nosniff` and never executed.
* **Roles** — `requireRole` guards every write; a manager who reaches the
  export URL directly still gets a 403.
* **Secrets** — in production the app refuses to boot without a `JWT_SECRET`
  of at least 32 characters. `npm run secret` generates one.
* **Process** — systemd, non-root, `ProtectSystem=strict`, writable only in
  `server/data`.

Deployment guide: `deploy/SERVERGA-JOYLASH.md`.

---

## Service manuals (admin only, QR-delivered)

**Manuals** is where an administrator writes, by hand, how a device is operated. A manual is
built out of **blocks**: each block carries an optional photograph of the device, a heading
and the explaining text. The editor opens with a single block and the **+** button adds as
many more as the instruction needs. Underneath sit the safety rules and the **responsible
person’s name and phone number**.

Manuals are **not part of the public site**: there is no index, no navigation entry and no
listing endpoint. A visitor reaches one only by scanning its QR (or following the direct
link), or from the page of a device an administrator has **attached** it to — attach devices
from the manual editor, or pick a manual in the device editor. `?print=1` opens the manual
straight into the browser print dialog.

---

## Contact page editing (admin only)

**Contact page** in the dashboard rewrites everything the public contact page and the footer
show: brand, legal name, tagline, address, the list of administrators (name, role, phone —
the `tel:` link is rebuilt automatically) and the channels (label, handle, URL, with a live
QR preview). Saving updates the site immediately.

---

## Contacts (also in the footer of every page)

* **Fayzullo** — +998 88 210 09 24
* **SonYun** — +998 95 776 45 49
* Instagram **@medservis.uz** · Telegram **@fayzullo0518** · **fayzulloe17@gmail.com**

Each channel is rendered as a scannable QR code with the handle written underneath it, both
in the footer and on the contact page. All of it is editable from the dashboard.

---

## Design notes

* **Brand** — *Gold Med Nova*. The mark is a medical cross built from two rounded rectangles,
  in the same minimal two-tone construction as the reference wordmark, recoloured to the
  Gold Med Nova palette.
* **Colour** — the light theme is built on **Cloud Dancer** (`#F4F3EF`), Pantone's Colour of
  the Year 2026, with Nova Blue `#3B5BFF` and Nova Cyan `#38D6E0`. The hero stays strictly
  black-and-white; everything else uses the accents.
* **Dark mode** — a full second token set on `:root[data-theme="dark"]`, following the OS
  until the visitor picks a side.
* **Hero** — the supplied clip (same URL, `autoPlay muted playsInline`, 80 % wrapper on
  mobile / 100 % on desktop), and nothing over it. The scanner cut-out that used to float on
  the footage was taking attention away from it, so the film now carries the section alone.
  The scanner still appears with a parallax in the *How it works* section below.
* **Reduced motion** — every scroll-driven and looping animation collapses under
  `prefers-reduced-motion: reduce`.
* **Responsive** — mobile-first, 768 px on the hero and 900–1100 px on the chrome; verified
  for zero horizontal overflow at 375 px on every page.

---

## Layout

```
nova-med/
├─ client/                       Vite + React 19
│  ├─ public/products/           233 device photos extracted from the catalogue
│  ├─ public/mri-scanner.png
│  └─ src/
│     ├─ components/             Logo, SiteHeader, Footer, ProductCard, QrCard
│     │  └─ admin/               AdminSidebar, ProductModal, CategoryModal,
│     │                          ManualModal, RequestModal, ProductPreviewModal,
│     │                          ContactEditor, AssetModal, MapPicker,
│     │                          NotificationBell
│     ├─ lib/                    api, auth, theme, i18n (uz/ru/en), contacts,
│     │                          reference (classification + spec template), routes
│     ├─ pages/                  Home, Market, Product, Contact, Manual, Login,
│     │                          Admin, QrLanding
│     └─ styles/                 plain CSS — tokens + one file per surface
└─ server/                       Express API
   ├─ data/catalog.js            the 12 imported catalogues, 233 devices (read-only)
   ├─ data/classification.js     15 fields → 67 groups → 326 device types
   ├─ data/reference.js          Fergana districts, conditions, funding, spec sheet
   ├─ assets.js                  the fleet register + notification feed
   ├─ xlsx.js                    dependency-free .xlsx writer (zip + SpreadsheetML)
   ├─ data/db.json               runtime state — created on first run
   ├─ data/uploads/              device photos uploaded from the dashboard
   ├─ store.js                   merges the imported catalogue with runtime edits,
   │                             plus manuals and contact-page content
   ├─ db.js                      JSON persistence + scrypt password hashing
   └─ index.js                   routes
```

Delete `server/data/db.json` to reset everything back to the imported catalogue.

---

## API

| Method | Route                        | Auth        |
| ------ | ---------------------------- | ----------- |
| GET    | `/api/health`                | –           |
| GET    | `/api/contacts`              | –           |
| GET    | `/api/categories`            | –           |
| GET    | `/api/products`              | –           |
| GET    | `/api/products/featured`     | –           |
| GET    | `/api/products/:id`          | –           |
| GET    | `/api/manuals/:id`           | – (by id only — manuals are never listed) |
| POST   | `/api/inquiries`             | –           |
| POST   | `/api/auth/login`            | –           |
| GET    | `/api/auth/me`               | token       |
| POST   | `/api/auth/password`         | token       |
| GET    | `/api/admin/stats`           | token       |
| GET    | `/api/admin/users`           | token       |
| POST   | `/api/admin/users`           | super admin |
| PATCH  | `/api/admin/users/:id`       | super admin |
| DELETE | `/api/admin/users/:id`       | super admin |
| GET    | `/api/admin/inquiries`       | token       |
| PATCH  | `/api/admin/inquiries/:id`   | token       |
| GET    | `/api/admin/categories`      | token       |
| POST   | `/api/admin/categories`      | admin+      |
| PATCH  | `/api/admin/categories/:id`  | admin+      |
| DELETE | `/api/admin/categories/:id`  | admin+      |
| GET    | `/api/admin/products`        | token       |
| POST   | `/api/admin/products`        | admin+      |
| PATCH  | `/api/admin/products/:id`    | admin+      |
| DELETE | `/api/admin/products/:id`    | admin+      |
| GET    | `/api/admin/manuals`         | token       |
| GET    | `/api/admin/manuals/:id`     | token       |
| POST   | `/api/admin/manuals`         | admin+      |
| PATCH  | `/api/admin/manuals/:id`     | admin+      |
| DELETE | `/api/admin/manuals/:id`     | admin+      |
| PUT    | `/api/admin/contacts`        | admin+      |
| POST   | `/api/admin/uploads`         | admin+      |
| GET    | `/api/reference`             | – (classification tree, districts, statuses, spec template) |
| GET    | `/api/qr/:assetId`           | – (public view of one machine) |
| PATCH  | `/api/qr/:assetId/status`    | – (condition change from the printed label) |
| GET    | `/api/admin/assets`          | token       |
| POST   | `/api/admin/assets`          | admin+      |
| PATCH  | `/api/admin/assets/:id`      | admin+      |
| DELETE | `/api/admin/assets/:id`      | admin+      |
| GET    | `/api/admin/assets/export.xlsx`   | token  |
| GET    | `/api/admin/classification.xlsx`  | token  |
| GET    | `/api/admin/notifications`        | token  |
| POST   | `/api/admin/notifications/read`    | token  |
| POST   | `/api/admin/files`           | admin+ (raw bytes, up to 50 MB) |
