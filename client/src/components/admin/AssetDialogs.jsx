import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import {
  X,
  Printer,
  ExternalLink,
  Pencil,
  History,
  FileText,
  MapPin,
  Copy,
  Check,
} from 'lucide-react';

import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';
import { formatBytes } from '../../lib/reference.js';
import { useContacts } from '../../lib/contact.js';
import { qrUrl } from '../../lib/routes.js';

const EASE = [0.16, 1, 0.3, 1];

function Shell({ title, sub, onClose, children, footer, wide }) {
  const { t } = useI18n();
  return (
    <div className="adm-modal-bg" onClick={onClose} role="presentation">
      <motion.div
        className={`adm-modal${wide ? ' adm-modal-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, ease: EASE }}
        role="dialog"
        aria-modal="true"
      >
        <div className="dlg-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="sub">{sub}</p>}
          </div>
          <button type="button" className="row-btn" onClick={onClose} aria-label={t('nav.close')}>
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="adm-modal-actions">{footer}</div>}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ko‘rish — the whole record, read only                               */
/* ------------------------------------------------------------------ */

export function AssetViewModal({ asset, canEdit, onClose, onEdit, onHistory }) {
  const { t } = useI18n();
  const [photo, setPhoto] = useState(asset.images?.[0]?.url || null);

  const rows = [
    [t('mon.class1'), asset.classGroupName],
    [t('mon.class2'), asset.classSectionName],
    [t('mon.class3'), asset.classItemName],
    [t('mon.manufacturer'), asset.manufacturer],
    [t('mon.manufacturerCountry'), asset.manufacturerCountry],
    [t('mon.productionCountry'), asset.productionCountry],
    [t('mon.serial'), asset.serial],
    [t('mon.produced'), asset.producedAt],
    [t('mon.purchased'), asset.purchasedAt],
    [t('mon.warranty'), asset.warrantyUntil],
    [t('mon.sold'), asset.soldAt],
    [t('mon.price'), asset.price],
    [t('mon.region'), asset.regionName],
    [t('mon.district'), asset.districtName],
    [t('mon.org'), asset.organization],
  ];

  const files = [asset.contractFile, asset.invoiceFile, ...(asset.extraFiles || [])].filter(Boolean);

  return (
    <Shell
      wide
      title={asset.name}
      sub={`${asset.model}${asset.serial ? ` · ${asset.serial}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => onHistory(asset)}>
            <History size={15} /> {t('mon.row.history')}
          </button>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => onEdit(asset)}>
              <Pencil size={15} /> {t('mon.row.edit')}
            </button>
          )}
        </>
      }
    >
      <div className="dlg-view">
        <div className="dlg-view-media">
          <div className="dlg-view-stage">
            {photo ? <img src={photo} alt={asset.name} /> : <span>{t('mon.photosHint')}</span>}
          </div>
          {(asset.images || []).length > 1 && (
            <div className="dlg-view-thumbs">
              {asset.images.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  className={photo === img.url ? 'active' : ''}
                  onClick={() => setPhoto(img.url)}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="dlg-view-status">
            <span className={`tag mon-tag is-${asset.status}`}>{t(`status.${asset.status}`)}</span>
            {asset.warrantyUntil && (
              <span className="tag">
                {asset.warrantyActive ? t('mon.warrantyActive') : t('mon.warrantyExpired')}
              </span>
            )}
          </div>

          {asset.faultReason && <div className="dlg-view-fault">{asset.faultReason}</div>}

          {(asset.lat !== null || asset.lng !== null) && (
            <p className="mn-hint">
              <MapPin size={12} style={{ verticalAlign: '-2px', marginRight: 5 }} />
              {asset.lat}, {asset.lng}
            </p>
          )}
        </div>

        <div className="dlg-view-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value || '—'}</b>
            </div>
          ))}

          {files.length > 0 && (
            <div className="dlg-view-files">
              <span>{t('mon.fileAttached')}</span>
              <div>
                {files.map((f) => (
                  <a key={f.url} href={f.url} target="_blank" rel="noreferrer" download={f.name}>
                    <FileText size={13} /> {f.name} <em>{formatBytes(f.size)}</em>
                  </a>
                ))}
              </div>
            </div>
          )}

          {asset.notes && (
            <div className="dlg-view-notes">
              <span>{t('mon.notes')}</span>
              <p>{asset.notes}</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* O‘zgarishlar tarixi                                                 */
/* ------------------------------------------------------------------ */

const ACTION_KEY = {
  created: 'mon.hist.created',
  updated: 'mon.hist.updated',
  status: 'mon.hist.status',
};

export function AssetHistoryModal({ asset, onClose }) {
  const { t } = useI18n();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api(`/admin/assets/${asset.id}/history`, { auth: true })
      .then((data) => !cancelled && setEntries(data.history || []))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  return (
    <Shell
      title={t('mon.hist.title')}
      sub={`${asset.model} · ${asset.name}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('nav.close')}
        </button>
      }
    >
      {error && <div className="form-alert bad">{error}</div>}

      <div className="dlg-hist">
        {entries === null && <div className="adm-empty">{t('market.loading')}</div>}
        {entries?.length === 0 && <div className="adm-empty">{t('mon.hist.empty')}</div>}

        {(entries || []).map((entry) => (
          <div className={`dlg-hist-row is-${entry.action}`} key={entry.id}>
            <div className="dlg-hist-top">
              <b>{t(ACTION_KEY[entry.action] || 'mon.hist.updated')}</b>
              <time>{new Date(entry.at).toLocaleString()}</time>
            </div>
            <em>{entry.actor}</em>
            {entry.changes?.length > 0 && (
              <ul>
                {entry.changes.map((change, i) => (
                  <li key={`${change.field}-${i}`}>
                    <span>{change.label}</span>
                    <span className="from">{change.from}</span>
                    <span className="arrow">→</span>
                    <span className="to">{change.to}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* QR-kod                                                              */
/* ------------------------------------------------------------------ */

/** the printed label is this wide, in millimetres */
const PRINT_SIZES = [25, 35, 45, 60, 80];
const DEFAULT_PRINT_MM = 45;

export function AssetQrModal({ asset, onClose }) {
  const { t } = useI18n();
  const contacts = useContacts();
  const [copied, setCopied] = useState(false);
  const [mm, setMm] = useState(DEFAULT_PRINT_MM);
  const url = qrUrl(asset.id);

  const firm = contacts.brand || 'Gold Med Nova';
  const phone = contacts.admins?.[0]?.phone || '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard can be blocked — the address is on screen either way */
    }
  };

  return (
    <Shell
      title={t('mon.qr')}
      sub={`${asset.model} · ${asset.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={15} /> {t('manual.print')}
          </button>
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> {t('common.open')}
          </a>
        </>
      }
    >
      <div className="dlg-qr">
        <span className="qr-frame">
          <QRCode value={url} size={190} bgColor="#FFFFFF" fgColor="#101828" level="M" />
        </span>
        <div>
          <p className="mn-hint" style={{ marginTop: 0 }}>
            {t('mon.qrHint')}
          </p>
          <button type="button" className="dlg-qr-url" onClick={copy}>
            <span>{url}</span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {/* how big the sticker comes out of the printer */}
          <div className="dlg-qr-size">
            <label htmlFor="qr-mm">{t('mon.print.size')}</label>
            <div className="dlg-qr-size-row">
              {PRINT_SIZES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`cat-pill${mm === value ? ' active' : ''}`}
                  onClick={() => setMm(value)}
                >
                  {value} mm
                </button>
              ))}
            </div>
            <input
              id="qr-mm"
              type="range"
              min="20"
              max="120"
              step="1"
              value={mm}
              onChange={(e) => setMm(Number(e.target.value))}
            />
            <em>{t('mon.print.hint', { mm })}</em>
          </div>

          <div className="dlg-qr-facts">
            <div>
              <span>{t('mon.serial')}</span>
              <b>{asset.serial || '—'}</b>
            </div>
            <div>
              <span>{t('mon.org')}</span>
              <b>{asset.organization}</b>
            </div>
            <div>
              <span>{t('qr.status')}</span>
              <b className={`qr-status is-${asset.status}`}>{t(`status.${asset.status}`)}</b>
            </div>
          </div>
        </div>
      </div>

      {/*
        What the printer actually puts on paper: the code, the firm name and
        the phone number — nothing else on the page. Hidden on screen, and the
        print stylesheet hides everything but this block.
      */}
      <div className="qr-print" aria-hidden="true">
        <div className="qr-print-label" style={{ width: `${mm}mm` }}>
          <QRCode
            value={url}
            size={512}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <b>{firm}</b>
          {phone && <span>{phone}</span>}
        </div>
      </div>
    </Shell>
  );
}
