/**
 * Reference lists used by the monitoring form and by the device pages.
 * Everything here is data only — no state, no persistence.
 */

/* ------------------------------------------------------------------ */
/* hududlar                                                            */
/*                                                                     */
/* The whole country lives in data/regions.js — 14 regions, 205         */
/* districts and cities — and is re-exported here so the form only has  */
/* one place to read reference data from.                              */
/* ------------------------------------------------------------------ */

export { REGIONS, COUNTRY_CENTER, findRegion, districtName, regionName } from "./regions.js";

/** map centre before a region is picked */
export const DEFAULT_MAP_CENTER = { lat: 41.3775, lng: 64.5853, zoom: 6 };

/* ------------------------------------------------------------------ */
/* asset condition                                                     */
/* ------------------------------------------------------------------ */

export const ASSET_STATUSES = [
  { id: 'soz', name: 'Soz', tone: 'ok' },
  { id: 'nosoz', name: 'Nosoz', tone: 'warn' },
  { id: 'yaroqsiz', name: 'Yaroqsiz', tone: 'bad' },
];

export const STATUS_IDS = ASSET_STATUSES.map((s) => s.id);

/** a fault description is required for these two */
export const STATUSES_NEEDING_REASON = ['nosoz', 'yaroqsiz'];

export const FUNDING_SOURCES = [
  { id: 'davlat-byudjeti', name: 'Davlat byudjeti' },
  { id: 'mahalliy-byudjet', name: 'Mahalliy byudjet' },
  { id: 'byudjetdan-tashqari', name: 'Byudjetdan tashqari mablag‘' },
  { id: 'grant', name: 'Grant / xalqaro loyiha' },
  { id: 'homiylik', name: 'Homiylik mablag‘i' },
  { id: 'lizing', name: 'Lizing' },
  { id: 'kredit', name: 'Kredit' },
  { id: 'boshqa', name: 'Boshqa manba' },
];

/* ------------------------------------------------------------------ */
/* the standard technical sheet                                        */
/*                                                                     */
/* Every device on the marketplace is described with the SAME rows, so  */
/* the product page always looks identical — only the values differ.    */
/* Devices may add their own extra rows underneath.                     */
/* ------------------------------------------------------------------ */

export const SPEC_TEMPLATE = [
  { key: 'manufacturer', label: 'Ishlab chiqaruvchi', placeholder: 'Gold Med Nova', primary: true },
  { key: 'country', label: 'Ishlab chiqarilgan mamlakat', placeholder: 'Xitoy', primary: true },
  { key: 'type', label: 'Uskuna turi', placeholder: 'Statsionar / ko‘char', primary: true },
  { key: 'power', label: 'Elektr ta’minoti', placeholder: '220 V / 50 Hz', primary: true },
  { key: 'consumption', label: 'Quvvat sarfi', placeholder: '1.5 kVt' },
  { key: 'dimensions', label: 'O‘lchamlari (uz × en × bal)', placeholder: '1200 × 700 × 1450 mm' },
  { key: 'weight', label: 'Og‘irligi', placeholder: '180 kg' },
  { key: 'display', label: 'Displey va boshqaruv', placeholder: '15" LCD sensorli' },
  { key: 'capacity', label: 'Unumdorlik / sig‘im', placeholder: '200 test/soat' },
  { key: 'environment', label: 'Ish sharoiti', placeholder: '+10…+30 °C, 30–75 % namlik' },
  { key: 'software', label: 'Dasturiy ta’minot', placeholder: 'DICOM 3.0, HL7' },
  { key: 'standards', label: 'Standart va sertifikatlar', placeholder: 'CE, ISO 13485' },
  { key: 'warrantyTerm', label: 'Kafolat muddati', placeholder: '24 oy' },
  { key: 'accessories', label: 'Komplektatsiya', placeholder: 'Datchiklar, kabellar, aravacha' },
];

export const SPEC_KEYS = SPEC_TEMPLATE.map((s) => s.key);

/** the four rows shown on the card and in the mobile summary */
export const PRIMARY_SPEC_KEYS = SPEC_TEMPLATE.filter((s) => s.primary).map((s) => s.key);

/** everything the /api/reference endpoint hands to the client in one go */
export const referencePayload = (classification, regions) => ({
  classification,
  regions,
  statuses: ASSET_STATUSES,
  statusesNeedingReason: STATUSES_NEEDING_REASON,
  fundingSources: FUNDING_SOURCES,
  specTemplate: SPEC_TEMPLATE,
  mapCenter: DEFAULT_MAP_CENTER,
});
