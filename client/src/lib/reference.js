import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Reference data the forms are built from — the three-level classification
 * tree, the districts of Fergana region, the condition values, the funding
 * sources and the standard technical sheet. It never changes at runtime, so
 * one fetch per page load is shared by every component that asks for it.
 */

export const EMPTY_REFERENCE = {
  classification: [],
  regions: [],
  districts: [],
  statuses: [
    { id: 'soz', name: 'Soz', tone: 'ok' },
    { id: 'nosoz', name: 'Nosoz', tone: 'warn' },
    { id: 'yaroqsiz', name: 'Yaroqsiz', tone: 'bad' },
  ],
  statusesNeedingReason: ['nosoz', 'yaroqsiz'],
  fundingSources: [],
  specTemplate: [],
  mapCenter: { lat: 40.3864, lng: 71.7864, zoom: 9 },
};

let cached = null;
let inFlight = null;
const listeners = new Set();

function fetchReference() {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = api('/reference')
      .then((data) => {
        cached = { ...EMPTY_REFERENCE, ...data };
        listeners.forEach((fn) => fn(cached));
        return cached;
      })
      .catch(() => EMPTY_REFERENCE)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useReference() {
  const [reference, setReference] = useState(cached || EMPTY_REFERENCE);

  useEffect(() => {
    let alive = true;
    const onUpdate = (data) => alive && setReference(data);
    listeners.add(onUpdate);
    fetchReference().then(onUpdate);
    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return reference;
}

/* ------------------------------------------------------------------ */
/* helpers shared by the product page, the card and the panel          */
/* ------------------------------------------------------------------ */

/**
 * The standard sheet, rendered as the SAME rows for every device — an empty
 * value becomes a dash rather than disappearing, which is what keeps the
 * layout identical from one device to the next.
 *
 * @param {{key:string,label:string}[]} template
 * @param {Record<string,string>} values
 * @param {(key:string, fallback:string)=>string} translate  i18n `tr`
 */
export const standardRows = (template, values = {}, translate) =>
  (template || []).map((row) => ({
    key: row.key,
    label: translate ? translate(`speclabel.${row.key}`, row.label) : row.label,
    value: (values?.[row.key] || '').trim(),
    primary: Boolean(row.primary),
  }));

/** human file size, used by the photo and document pickers */
export const formatBytes = (bytes) => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
};
