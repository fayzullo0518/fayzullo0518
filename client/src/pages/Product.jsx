import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import {
  ArrowRight,
  Phone,
  Send,
  Mail,
  ChevronRight,
  ShieldCheck,
  BookOpenCheck,
} from 'lucide-react';

import Footer from '../components/Footer.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { api } from '../lib/api.js';
import { useContacts } from '../lib/contact.js';
import { useI18n } from '../lib/i18n.jsx';
import { useReference, standardRows } from '../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];

export default function Product() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { t, tr, tVal } = useI18n();
  const contacts = useContacts();
  const { specTemplate } = useReference();

  const [product, setProduct] = useState(null);
  const [active, setActive] = useState(null);
  const [state, setState] = useState('loading');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api(`/products/${productId}`)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        setActive(p.image);
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  /* Only this device's own photography — never another device's image. */
  const gallery = useMemo(() => {
    if (!product) return [];
    const own = [product.image, ...(product.images || [])].filter(Boolean);
    return [...new Set(own)];
  }, [product]);

  /* The standard sheet: the same rows, in the same order, on every device. */
  const standard = useMemo(
    () => standardRows(specTemplate, product?.standard, tr),
    [specTemplate, product, tr],
  );
  const primary = standard.filter((row) => row.primary);

  if (state === 'loading') {
    return (
      <>
        <div className="gh-spacer" />
        <div className="pd-loading">{t('product.loading')}</div>
        <Footer />
      </>
    );
  }

  if (state === 'missing' || !product) {
    return (
      <>
        <div className="gh-spacer" />
        <div className="container pd-missing">
          <h2>{t('product.missing.t')}</h2>
          <p>{t('product.missing.b')}</p>
          <Link className="btn btn-primary" to="/market" style={{ marginTop: 18 }}>
            {t('contact.noProduct.btn')} <ArrowRight size={15} />
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const manualUrl = product.manual ? `${window.location.origin}/manual/${product.manual.id}` : null;

  return (
    <>
      <div className="gh-spacer" />

      <div className="container pd-wrap">
        <nav className="pd-crumbs" aria-label={t('a11y.crumbs')}>
          <Link to="/market">{t('nav.market')}</Link>
          <ChevronRight size={13} className="sep" />
          <Link to={`/market?category=${product.category}`}>
            {tr(`catName.${product.category}`, product.categoryName || product.category)}
          </Link>
          <ChevronRight size={13} className="sep" />
          <span>{product.model}</span>
        </nav>

        <div className="pd-grid">
          {/* ---------------- gallery ---------------- */}
          <motion.div
            className="pd-gallery"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="pd-stage">
              <img src={active || product.image} alt={`${product.model} ${product.name}`} />
              {product.subcategory && <span className="pd-flag">{product.subcategory}</span>}
            </div>

            {gallery.length > 1 && (
              <div className="pd-thumbs">
                {gallery.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    className={`pd-thumb${active === src ? ' active' : ''}`}
                    onClick={() => setActive(src)}
                    aria-label={`${product.model} ${i + 1}`}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ---------------- information ---------------- */}
          <motion.div
            className="pd-info"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
          >
            <span className="pd-eyebrow">{product.model}</span>
            <h1 className="pd-title">{product.name}</h1>
            {product.summary && <p className="pd-summary">{product.summary}</p>}

            <div className="pd-facts">
              <div className="pd-fact">
                <b>{tVal(product.availability)}</b>
                <span>{t('product.availability')}</span>
              </div>
              <div className="pd-fact">
                <b>{tVal(product.leadTime)}</b>
                <span>{t('product.leadTime')}</span>
              </div>
              <div className="pd-fact">
                <b>{tVal(product.warranty)}</b>
                <span>{t('product.warranty')}</span>
              </div>
              <div className="pd-fact">
                <b>{product.price || t('product.onRequest')}</b>
                <span>{t('product.price')}</span>
              </div>
            </div>

            {/* the headline rows — the full sheet sits under the device */}
            <div className="pd-specs">
              <h3>{t('product.spec')}</h3>
              <div className="rows">
                {primary.map((row) => (
                  <div key={row.key}>
                    <span>{row.label}</span>
                    <b>{row.value ? tVal(row.value) : t('spec.none')}</b>
                  </div>
                ))}
                <div>
                  <span>{t('product.catalogue')}</span>
                  <b>{tr(`catName.${product.category}`, product.categoryName || product.category)}</b>
                </div>
                <div>
                  <span>{t('product.sku')}</span>
                  <b>{product.sku}</b>
                </div>
                <div>
                  <span>{t('product.cert')}</span>
                  <b>
                    <ShieldCheck
                      size={13}
                      style={{ display: 'inline', verticalAlign: '-2px', marginRight: 5 }}
                    />
                    {(product.certifications || ['CE']).join(' · ')}
                  </b>
                </div>
              </div>
            </div>

            {/* ---------------- contact button ---------------- */}
            <div className="pd-cta">
              <h3>{t('product.cta.t')}</h3>
              <p>{t('product.cta.b')}</p>
              <button
                type="button"
                className="pd-cta-main"
                onClick={() => navigate(`/contact/${product.id}`)}
              >
                {t('product.cta.btn', { model: product.model })} <ArrowRight size={17} />
              </button>
              <div className="pd-cta-quick">
                {contacts.admins.map((a) => (
                  <a key={a.id} href={a.phoneHref}>
                    <Phone size={13} /> {a.name} · {a.phone}
                  </a>
                ))}
                {contacts.channels[1] && (
                  <a href={contacts.channels[1].url} target="_blank" rel="noreferrer">
                    <Send size={13} /> {contacts.channels[1].handle}
                  </a>
                )}
                {contacts.channels[2] && (
                  <a href={contacts.channels[2].url}>
                    <Mail size={13} /> {contacts.channels[2].handle}
                  </a>
                )}
              </div>
            </div>

            {/* ---- service manual, only when an administrator attached one ---- */}
            {product.manual && (
              <div className="pd-cta" style={{ marginTop: 16 }}>
                <h3>
                  <BookOpenCheck size={15} style={{ verticalAlign: '-2px', marginRight: 7 }} />
                  {t('product.manual')}
                </h3>
                <p>{t('product.manual.b')}</p>

                <div
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    marginTop: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="qr-frame">
                    <QRCode
                      value={manualUrl}
                      size={96}
                      bgColor="#FFFFFF"
                      fgColor="#101828"
                      level="M"
                    />
                  </span>
                  <div>
                    <b style={{ fontSize: 14 }}>{product.manual.title}</b>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                      {product.manual.contactName || '—'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {product.manual.contactPhone || '—'}
                    </div>
                    <Link
                      className="btn btn-ghost btn-sm"
                      to={`/manual/${product.manual.id}`}
                      style={{ marginTop: 10 }}
                    >
                      {t('product.manual.open')} <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ----------------------------------------------------------------
            The technical sheet, under the device.

            The rows are the same for every machine on the marketplace — only
            the values change — so the page reads identically from one device
            to the next. On a phone only the headline rows show until the
            visitor taps “more information”.
        ---------------------------------------------------------------- */}
        <section className={`pd-sheet${showAll ? ' is-open' : ''}`}>
          <div className="pd-sheet-head">
            <div>
              <span className="eyebrow">
                <span className="dot" /> {t('spec.standard')}
              </span>
              <h2>{product.name}</h2>
              <p>{t('spec.standardHint')}</p>
            </div>
            <div className="pd-sheet-thumb" aria-hidden="true">
              <img src={product.image} alt="" loading="lazy" />
            </div>
          </div>

          <div className="pd-sheet-rows">
            {standard.map((row) => (
              <div className={`pd-sheet-row${row.primary ? '' : ' is-extra'}`} key={row.key}>
                <span>{row.label}</span>
                <b>{row.value ? tVal(row.value) : t('spec.none')}</b>
              </div>
            ))}
          </div>

          {product.specs?.length > 0 && (
            <div className="pd-sheet-extra is-extra">
              <h3>{t('spec.extra')}</h3>
              <div className="pd-sheet-rows">
                {product.specs.map((s) => (
                  <div className="pd-sheet-row" key={s.label}>
                    <span>{s.label}</span>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="pd-sheet-more"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
          >
            {showAll ? t('spec.less') : t('spec.more')}
            <ChevronRight size={14} className="chev" />
          </button>
        </section>

        {product.related?.length > 0 && (
          <section className="pd-related">
            <span className="eyebrow">
              <span className="dot" /> {t('product.related')}
            </span>
            <div className="related-grid">
              {product.related.slice(0, 4).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} specLimit={1} />
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </>
  );
}
