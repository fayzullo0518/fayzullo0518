import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Fallback contact details. They render immediately, then the live values
 * from `GET /api/contacts` (which an administrator can edit) replace them.
 */
export const CONTACT = {
  brand: 'Gold Med Nova',
  legal: 'Gold Med Nova Medical Devices',
  tagline: 'Medical equipment marketplace',
  address: 'Toshkent, O‘zbekiston',
  admins: [
    {
      id: 'fayzullo',
      name: 'Fayzullo',
      role: 'Head of Sales · Super admin',
      phone: '+998 88 210 09 24',
      phoneHref: 'tel:+998882100924',
      initials: 'F',
    },
    {
      id: 'sonyun',
      name: 'SonYun',
      role: 'Equipment consultant · Admin',
      phone: '+998 95 776 45 49',
      phoneHref: 'tel:+998957764549',
      initials: 'S',
    },
  ],
  channels: [
    {
      id: 'instagram',
      label: 'Instagram',
      handle: '@medservis.uz',
      url: 'https://instagram.com/medservis.uz',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      handle: '@fayzullo0518',
      url: 'https://t.me/fayzullo0518',
    },
    {
      id: 'email',
      label: 'Email',
      handle: 'fayzulloe17@gmail.com',
      url: 'mailto:fayzulloe17@gmail.com',
    },
  ],
};

/* one shared fetch, so every component that needs the contacts triggers at
   most one request per page load */
let cached = null;
let inFlight = null;
const listeners = new Set();

function fetchContacts() {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = api('/contacts')
      .then((data) => {
        cached = data;
        listeners.forEach((fn) => fn(data));
        return data;
      })
      .catch(() => CONTACT)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** live contact details, with the static defaults as the first paint */
export function useContacts() {
  const [contacts, setContacts] = useState(cached || CONTACT);

  useEffect(() => {
    let alive = true;
    const onUpdate = (data) => alive && setContacts(data);
    listeners.add(onUpdate);
    fetchContacts().then(onUpdate);
    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return contacts;
}

/** call after an administrator saves the contact page */
export function invalidateContacts() {
  cached = null;
  fetchContacts();
}
