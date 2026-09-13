import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import { BookOpenCheck, ShieldAlert, Printer, Phone, ArrowRight, Clock } from 'lucide-react';

import Footer from '../components/Footer.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

/**
 * The page a printed QR code opens. It is never linked from the public site —
 * only from the QR itself, or from the page of a device it is attached to.
 */
export default function Manual() {
  const { manualId } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();

  const [manual, setManual] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api(`/manuals/${manualId}`)
      .then((m) => {
        if (cancelled) return;
        setManual(m);
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [manualId]);

  // ?print=1 opens the browser print dialog once the manual has rendered
  useEffect(() => {
    if (state === 'ready' && params.get('print')) {
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state, params]);

  if (state === 'loading') {
    return (
      <>
        <div className="mp-missing">{t('product.loading')}</div>
        <Footer />
      </>
    );
  }

  if (state === 'missing' || !manual) {
    return (
      <>
        <div className="mp-missing">
          <h1>{t('manual.notFound.t')}</h1>
          <p>{t('manual.notFound.b')}</p>
          <Link className="btn btn-primary" to="/" style={{ marginTop: 20 }}>
            {t('nav.home')} <ArrowRight size={15} />
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const url = `${window.location.origin}/manual/${manual.id}`;
  const updated = new Date(manual.updatedAt || manual.createdAt);

  return (
    <>
      <motion.div
        className="mp"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="mp-top">
          <div>
            <span className="mp-eyebrow">
              <BookOpenCheck size={13} /> {t('manual.title')}
            </span>
            <h1 className="mp-title">{manual.title}</h1>
            <div className="mp-meta">
              {manual.deviceModel && <span>{manual.deviceModel}</span>}
              {manual.deviceName && <span>{manual.deviceName}</span>}
              <span>
                <Clock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {t('manual.updated')}: {updated.toLocaleDateString()}
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={15} /> {t('manual.print')}
          </button>
        </div>

        {manual.devices?.length > 0 && (
          <div className="mp-devices">
            {manual.devices.map((d) => (
              <Link key={d.id} className="mp-device" to={`/product/${d.id}`}>
                <span className="th">
                  <img src={d.image} alt="" />
                </span>
                <span>
                  <b>{d.model}</b>
                  <em>{d.name}</em>
                </span>
              </Link>
            ))}
          </div>
        )}

        {manual.intro && <div className="mp-intro">{manual.intro}</div>}

        {manual.sections?.map((s, i) => (
          <section className={`mp-section${s.image ? ' has-image' : ''}`} key={`${s.heading}-${i}`}>
            {s.heading && (
              <h2>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                {s.heading}
              </h2>
            )}
            {s.image && (
              <figure className="mp-section-image">
                <img src={s.image} alt={s.heading || ''} loading="lazy" />
              </figure>
            )}
            {s.body && <p>{s.body}</p>}
          </section>
        ))}

        {manual.safety?.length > 0 && (
          <section className="mp-safety">
            <h2>
              <ShieldAlert size={17} /> {t('manual.safety')}
            </h2>
            <ul>
              {manual.safety.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- QR + responsible person ---------- */}
        <div className="mp-card">
          <div className="mp-qr">
            <span className="qr-frame">
              <QRCode value={url} size={124} bgColor="#FFFFFF" fgColor="#101828" level="M" />
            </span>
            <span className="mp-qr-caption">
              <b>{manual.contactName || '—'}</b>
              <span>{manual.contactPhone || '—'}</span>
              <em>{t('manual.responsible')}</em>
            </span>
          </div>

          <div className="mp-card-body">
            <h3>{t('manual.qr')}</h3>
            <p>{t('manual.qrHint')}</p>
            <div className="row">
              {manual.contactPhone && (
                <a
                  className="btn btn-primary"
                  href={`tel:${manual.contactPhone.replace(/[^\d+]/g, '')}`}
                >
                  <Phone size={14} /> {manual.contactPhone}
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={14} /> {t('manual.print')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <Footer />
    </>
  );
}
