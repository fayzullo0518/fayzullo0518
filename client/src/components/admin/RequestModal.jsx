import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Phone, Mail, MapPin, Package, Clock, X, MessageSquare, ExternalLink, Send } from 'lucide-react';

import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

const initials = (name = '?') =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Full detail of one purchase request, including the customer's message. */
export default function RequestModal({ inquiry, onClose, onStatus }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(inquiry.status);
  const [busy, setBusy] = useState(false);

  const change = async (next) => {
    setBusy(true);
    setStatus(next);
    try {
      await onStatus(inquiry, next);
    } finally {
      setBusy(false);
    }
  };

  const when = new Date(inquiry.createdAt);

  return (
    <div className="adm-modal-bg" onClick={onClose} role="presentation">
      <motion.div
        className="adm-modal adm-modal-wide"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
        role="dialog"
        aria-modal="true"
      >
        <div className="rq-head">
          <span className="rq-av">{initials(inquiry.contactName)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{inquiry.contactName}</h3>
            <p className="sub">
              {when.toLocaleString()} · {inquiry.id}
            </p>
          </div>
          <span className={`tag tag-${status}`}>{t(`status.${status}`)}</span>
          <button
            type="button"
            className="row-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="rq-grid">
          <a className="rq-fact" href={`tel:${inquiry.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={14} />
            <span>
              <em>{t('contact.form.phone')}</em>
              <b>{inquiry.phone}</b>
            </span>
          </a>
          {inquiry.email && (
            <a className="rq-fact" href={`mailto:${inquiry.email}`}>
              <Mail size={14} />
              <span>
                <em>{t('contact.form.email')}</em>
                <b>{inquiry.email}</b>
              </span>
            </a>
          )}
          <div className="rq-fact">
            <MapPin size={14} />
            <span>
              <em>{t('contact.form.region')}</em>
              <b>{inquiry.region || '—'}</b>
            </span>
          </div>
          <div className="rq-fact">
            <Package size={14} />
            <span>
              <em>{t('contact.form.qty')}</em>
              <b>{inquiry.quantity}</b>
            </span>
          </div>
        </div>

        {inquiry.productId && (
          <Link className="rq-device" to={`/product/${inquiry.productId}`} target="_blank">
            <span className="rq-device-main">
              <em>{inquiry.productModel}</em>
              <b>{inquiry.productName}</b>
            </span>
            <ExternalLink size={15} />
          </Link>
        )}

        <div className="rq-message">
          <h4>
            <MessageSquare size={14} /> {t('contact.form.message')}
          </h4>
          <p>{inquiry.message?.trim() ? inquiry.message : '—'}</p>
        </div>

        <div className="rq-status">
          <span className="rq-status-label">
            <Clock size={13} /> {t('admin.requests')}
          </span>
          <div className="rq-status-pills">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`cat-pill${status === s ? ' active' : ''}`}
                onClick={() => change(s)}
                disabled={busy}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="adm-modal-actions">
          <a
            className="btn btn-ghost"
            href={`tel:${inquiry.phone.replace(/[^\d+]/g, '')}`}
          >
            <Phone size={14} /> {inquiry.phone}
          </a>
          {inquiry.email && (
            <a className="btn btn-primary" href={`mailto:${inquiry.email}`}>
              <Send size={14} /> {t('contact.writeUs')}
            </a>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
