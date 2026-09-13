import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, Send, Instagram, MapPin } from 'lucide-react';

import Logo from './Logo.jsx';
import QrCard from './QrCard.jsx';
import { useContacts } from '../lib/contact.js';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';

const CHANNEL_ICONS = { instagram: Instagram, telegram: Send, email: Mail };

export default function Footer() {
  const { t, tCat } = useI18n();
  const contacts = useContacts();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api('/categories')
      .then((c) => setCategories(c.slice(0, 6)))
      .catch(() => setCategories([]));
  }, []);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo size={24} />
            <p className="footer-brandline">{t('footer.about')}</p>
            <p className="footer-brandline" style={{ marginTop: 12, fontSize: 12.5 }}>
              <MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
              {contacts.address || t('footer.address')}
            </p>
          </div>

          <div className="footer-col">
            <h4>{t('footer.catalogues')}</h4>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/market?category=${c.id}`}>{tCat(c)}</Link>
                </li>
              ))}
              <li>
                <Link to="/market">{t('footer.all')}</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{t('footer.company')}</h4>
            <ul>
              <li>
                <Link to="/">{t('nav.home')}</Link>
              </li>
              <li>
                <Link to="/market">{t('nav.market')}</Link>
              </li>
              <li>
                <Link to="/contact">{t('footer.contactOrder')}</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{t('footer.orderVia')}</h4>
            <div className="footer-admins">
              {contacts.admins.map((a) => (
                <a key={a.id} className="footer-admin" href={a.phoneHref}>
                  <span className="av">{a.initials || a.name.slice(0, 1)}</span>
                  <span>
                    <span className="nm">{a.name}</span>
                    <span className="ph">
                      <Phone size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                      {a.phone}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            <h4 style={{ marginTop: 22 }}>{t('footer.scan')}</h4>
            <div className="qr-row">
              {contacts.channels.map((c) => (
                <QrCard key={c.id} label={c.label} handle={c.handle} url={c.url} size={76} />
              ))}
            </div>

            <ul style={{ marginTop: 18 }}>
              {contacts.channels.map((c) => {
                const Icon = CHANNEL_ICONS[c.id] || Send;
                return (
                  <li key={c.id}>
                    <a
                      href={c.url}
                      target={c.url.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                    >
                      <Icon size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                      {c.handle}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {contacts.legal || 'Gold Med Nova'}. {t('footer.rights')}
          </span>
          <span>{t('footer.source')}</span>
        </div>
      </div>
    </footer>
  );
}
