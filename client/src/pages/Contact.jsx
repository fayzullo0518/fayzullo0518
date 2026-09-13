import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Phone,
  Send,
  Mail,
  Instagram,
  Plus,
  ArrowRight,
  Pencil,
  Sliders,
  UserRound,
  PanelRight,
  Clock,
  Calendar,
  Building2,
} from 'lucide-react';

import Footer from '../components/Footer.jsx';
import QrCard from '../components/QrCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { useContacts } from '../lib/contact.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

const PALETTES = [
  'linear-gradient(150deg, #6D3BEF 0%, #8B5CF6 55%, #A78BFA 100%)',
  'linear-gradient(150deg, #F5B93B 0%, #F7CE68 55%, #FCE3A2 100%)',
  'linear-gradient(150deg, #2BA8E0 0%, #57C8F0 55%, #9BDFF7 100%)',
];

const CHANNEL_ICONS = { instagram: Instagram, telegram: Send, email: Mail };

function FloatingDevice({ src, className, delay = 0, disabled }) {
  return (
    <motion.div
      className={`float-item ${className}`}
      initial={{ opacity: 0, y: 26, scale: 0.9 }}
      animate={
        disabled
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: [0, -14, 0], scale: 1, rotate: [0, 2.5, 0] }
      }
      transition={
        disabled
          ? { duration: 0.8, ease: EASE }
          : {
              opacity: { duration: 0.9, delay, ease: EASE },
              scale: { duration: 0.9, delay, ease: EASE },
              y: { duration: 7, delay, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 9, delay, repeat: Infinity, ease: 'easeInOut' },
            }
      }
    >
      <img src={src} alt="" aria-hidden="true" loading="lazy" />
    </motion.div>
  );
}

export default function Contact() {
  const { productId } = useParams();
  const reduce = useReducedMotion();
  const { t, tVal } = useI18n();
  const { canEdit } = useAuth();
  const contacts = useContacts();

  const [product, setProduct] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    email: '',
    region: '',
    quantity: 1,
    message: '',
  });
  const [status, setStatus] = useState({ state: 'idle', text: '' });

  useEffect(() => {
    let cancelled = false;
    if (productId) {
      api(`/products/${productId}`)
        .then((p) => !cancelled && setProduct(p))
        .catch(() => !cancelled && setProduct(null));
    } else {
      setProduct(null);
    }
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    api('/products/featured')
      .then((list) => !cancelled && setGallery(list))
      .catch(() => !cancelled && setGallery([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => setPaletteIndex((i) => (i + 1) % PALETTES.length), 5200);
    return () => clearInterval(id);
  }, [reduce]);

  const floats = useMemo(() => {
    if (product) {
      const rel = product.related || [];
      return [product.image, rel[0]?.image, rel[1]?.image].filter(Boolean);
    }
    return gallery.slice(0, 3).map((p) => p.image);
  }, [product, gallery]);

  const rows = useMemo(() => {
    const adminRows = contacts.admins.map((a) => ({
      key: a.id,
      name: a.name,
      role: a.role,
      meta: a.phone,
      href: a.phoneHref,
      icon: Phone,
    }));
    const channelRows = contacts.channels.map((c) => ({
      key: c.id,
      name: c.label,
      role: c.handle,
      meta: c.id === 'email' ? t('contact.writeUs') : t('contact.messageUs'),
      href: c.url,
      icon: CHANNEL_ICONS[c.id] || Send,
      external: c.url.startsWith('http'),
    }));
    return [...adminRows, ...channelRows];
  }, [contacts, t]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'sending', text: '' });
    try {
      await api('/inquiries', {
        method: 'POST',
        body: { ...form, productId: product?.id || null },
      });
      setStatus({ state: 'ok', text: t('contact.form.ok') });
      setForm({ contactName: '', phone: '', email: '', region: '', quantity: 1, message: '' });
    } catch (err) {
      setStatus({ state: 'bad', text: err.message });
    }
  };

  const headline = product ? product.model : t('contact.headline');

  return (
    <>
      <div className="gh-spacer" />

      <section className="contact-stage">
        {canEdit && (
          <div style={{ maxWidth: 1120, margin: '0 auto 14px', textAlign: 'right' }}>
            <Link className="btn btn-ghost btn-sm" to="/admin">
              <Pencil size={13} /> {t('contact.edit')}
            </Link>
          </div>
        )}

        <motion.div
          className="contact-card"
          initial={{ opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          {/* ---------- left: colour blob ---------- */}
          <div className="contact-blob">
            <div
              className="contact-blob-bg"
              style={{ background: PALETTES[paletteIndex] }}
              aria-hidden="true"
            />
            <div className="contact-blob-noise" aria-hidden="true" />

            <span className="blob-mark">
              <LogoMark size={22} tone="mono" />
            </span>

            <h1>
              {headline.split('\n').map((line) => (
                <span key={line} style={{ display: 'block' }}>
                  {line}
                </span>
              ))}
            </h1>
            <p className="blob-sub">{product ? product.name : t('contact.blobSub')}</p>
            <span className="blob-chip">
              <Clock size={12} /> {t('contact.reply')}
            </span>

            {floats[0] && (
              <FloatingDevice src={floats[0]} className="float-1" delay={0.1} disabled={reduce} />
            )}
            {floats[1] && (
              <FloatingDevice src={floats[1]} className="float-2" delay={0.45} disabled={reduce} />
            )}
            {floats[2] && (
              <FloatingDevice src={floats[2]} className="float-3" delay={0.8} disabled={reduce} />
            )}
          </div>

          {/* ---------- right: contact list ---------- */}
          <div className="contact-list">
            <div className="contact-list-head">
              <div>
                <h2>
                  {t('contact.title1')}
                  <br />
                  {t('contact.title2')}
                </h2>
              </div>
              <span className="contact-avatar" aria-hidden="true">
                😄
              </span>
            </div>

            {product && (
              <div className="contact-selected">
                <span className="thumb">
                  <img src={product.image} alt="" />
                </span>
                <div>
                  <div className="m">{product.model}</div>
                  <div className="n">{product.name}</div>
                  <div className="s">
                    {product.subcategory} · {tVal(product.availability)} · {tVal(product.leadTime)}
                  </div>
                </div>
              </div>
            )}

            <div className="contact-table-head">
              <span>{t('contact.tableContact')}</span>
              <span>{t('contact.tableOpen')}</span>
            </div>

            <div className="contact-rows">
              {rows.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.a
                    key={r.key}
                    className="contact-row"
                    href={r.href}
                    target={r.external ? '_blank' : undefined}
                    rel={r.external ? 'noreferrer' : undefined}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 + i * 0.07, ease: EASE }}
                  >
                    <span>
                      <span className="r-name">{r.name}</span>
                      <span className="r-role" style={{ display: 'block' }}>
                        {r.role}
                      </span>
                    </span>
                    <span className="r-meta">{r.meta}</span>
                    <span className="r-thumb">
                      <Icon size={17} color="var(--text-2)" />
                    </span>
                    <span className="r-add">
                      <Plus size={14} strokeWidth={2.6} />
                    </span>
                  </motion.a>
                );
              })}
            </div>

            <div className="contact-corner-left" aria-hidden="true">
              <span className="corner-dot">
                <Building2 size={15} />
              </span>
              <span className="corner-line" />
              <span className="corner-dot">
                <Clock size={15} />
              </span>
              <span className="corner-line" />
              <span className="corner-dot">
                <Calendar size={15} />
              </span>
            </div>

            <div className="contact-corner-right" aria-hidden="true">
              <span className="corner-dot">
                <PanelRight size={15} />
              </span>
            </div>
          </div>

          {/* ---------- floating toolbar ---------- */}
          <div className="contact-toolbar">
            {contacts.admins[0] && (
              <a className="tb" href={contacts.admins[0].phoneHref} aria-label={contacts.admins[0].name}>
                <Phone size={15} />
              </a>
            )}
            {contacts.channels[1] && (
              <a
                className="tb on"
                href={contacts.channels[1].url}
                target="_blank"
                rel="noreferrer"
                aria-label={contacts.channels[1].label}
              >
                <Pencil size={15} />
              </a>
            )}
            {contacts.channels[2] && (
              <a className="tb" href={contacts.channels[2].url} aria-label={contacts.channels[2].label}>
                <UserRound size={15} />
              </a>
            )}
            <span className="divider" />
            <a className="tb" href="#enquiry" aria-label={t('contact.form.t')}>
              <Sliders size={15} />
            </a>
            <a className="go" href="#enquiry" aria-label={t('contact.form.send')}>
              <ArrowRight size={16} />
            </a>
          </div>
        </motion.div>

        {/* ---------- below the card ---------- */}
        <div className="contact-below">
          <div className="contact-grid">
            <div className="panel" id="enquiry">
              <h3>{t('contact.form.t')}</h3>
              <p className="panel-sub">
                {product
                  ? t('contact.form.b', { model: product.model })
                  : t('contact.form.bGeneric')}
              </p>

              <form className="form-grid" onSubmit={submit}>
                <div className="field">
                  <label htmlFor="contactName">{t('contact.form.name')}</label>
                  <input
                    id="contactName"
                    required
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder={t('contact.form.namePh')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">{t('contact.form.phone')}</label>
                  <input
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+998 90 000 00 00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">{t('contact.form.email')}</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@clinic.uz"
                  />
                </div>
                <div className="field">
                  <label htmlFor="region">{t('contact.form.region')}</label>
                  <input
                    id="region"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder={t('contact.form.regionPh')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="quantity">{t('contact.form.qty')}</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="message">{t('contact.form.message')}</label>
                  <textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={t('contact.form.messagePh')}
                  />
                </div>
                <div className="field full">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={status.state === 'sending'}
                  >
                    {status.state === 'sending' ? t('contact.form.sending') : t('contact.form.send')}{' '}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>

              {status.state === 'ok' && <div className="form-alert ok">{status.text}</div>}
              {status.state === 'bad' && <div className="form-alert bad">{status.text}</div>}

              {contacts.admins.length >= 2 && (
                <p className="form-note">
                  {t('contact.form.note', {
                    a: contacts.admins[0].name,
                    ap: contacts.admins[0].phone,
                    b: contacts.admins[1].name,
                    bp: contacts.admins[1].phone,
                  })}
                </p>
              )}
            </div>

            <div className="panel">
              <h3>{t('contact.admins.t')}</h3>
              <p className="panel-sub">{t('contact.admins.b')}</p>

              <div className="admin-cards">
                {contacts.admins.map((a) => (
                  <a key={a.id} className="admin-card" href={a.phoneHref}>
                    <span className="av">{a.initials || a.name.slice(0, 1)}</span>
                    <div className="nm">{a.name}</div>
                    <div className="rl">{a.role}</div>
                    <div className="ph">{a.phone}</div>
                  </a>
                ))}
              </div>

              <h3 style={{ marginTop: 26 }}>{t('contact.qr.t')}</h3>
              <p className="panel-sub">{t('contact.qr.b')}</p>
              <div className="qr-row" style={{ marginTop: 16 }}>
                {contacts.channels.map((c) => (
                  <QrCard key={c.id} label={c.label} handle={c.handle} url={c.url} size={92} />
                ))}
              </div>
            </div>
          </div>

          {product && (
            <>
              <div className="panel" style={{ marginTop: 22 }}>
                <h3>
                  {product.model} — {t('product.spec')}
                </h3>
                <p className="panel-sub">{product.summary}</p>
                <div className="spec-table">
                  {product.specs.map((s) => (
                    <div key={s.label}>
                      <span>{s.label}</span>
                      <b>{s.value}</b>
                    </div>
                  ))}
                  <div>
                    <span>{t('product.availability')}</span>
                    <b>{tVal(product.availability)}</b>
                  </div>
                  <div>
                    <span>{t('product.leadTime')}</span>
                    <b>{tVal(product.leadTime)}</b>
                  </div>
                  <div>
                    <span>{t('product.warranty')}</span>
                    <b>{tVal(product.warranty)}</b>
                  </div>
                  <div>
                    <span>{t('product.cert')}</span>
                    <b>{(product.certifications || []).join(' · ')}</b>
                  </div>
                </div>
              </div>

              {product.related?.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <span className="eyebrow">
                    <span className="dot" /> {t('product.related')}
                  </span>
                  <div className="related-grid">
                    {product.related.slice(0, 4).map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} specLimit={1} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!product && (
            <div className="panel" style={{ marginTop: 22, textAlign: 'center' }}>
              <h3>{t('contact.noProduct.t')}</h3>
              <p className="panel-sub" style={{ marginInline: 'auto' }}>
                {t('contact.noProduct.b')}
              </p>
              <Link className="btn btn-primary" to="/market" style={{ marginTop: 18 }}>
                {t('contact.noProduct.btn')} <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
