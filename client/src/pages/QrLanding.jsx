import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpenCheck,
  Info,
  Phone,
  ChevronLeft,
  ChevronRight,
  Send,
  Instagram,
  Mail,
  CheckCircle2,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

import Logo from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { useReference } from '../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];
const CHANNEL_ICONS = { instagram: Instagram, telegram: Send, email: Mail };

const STATUS_ICON = { soz: CheckCircle2, nosoz: AlertTriangle, yaroqsiz: AlertTriangle };

/**
 * What a printed QR code opens.
 *
 * Three buttons and nothing else: how to run the machine, what the machine is,
 * and who to call. The device panel is the only place a visitor can act — they
 * may change the condition, and every change is announced to the panel.
 */
export default function QrLanding() {
  const { assetId } = useParams();
  const { t } = useI18n();
  const reference = useReference();

  const [asset, setAsset] = useState(null);
  const [state, setState] = useState('loading');
  const [view, setView] = useState('menu');

  useEffect(() => {
    let cancelled = false;
    api(`/qr/${assetId}`)
      .then((data) => {
        if (cancelled) return;
        setAsset(data);
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (state === 'loading') {
    return <div className="qr-page qr-center">{t('qr.loading')}</div>;
  }

  if (state === 'missing' || !asset) {
    return (
      <div className="qr-page qr-center">
        <div className="qr-card">
          <h1>{t('qr.notFound')}</h1>
          <p>{t('qr.notFoundBody')}</p>
          <Link className="btn btn-primary" to="/" style={{ marginTop: 18 }}>
            {t('nav.home')}
          </Link>
        </div>
      </div>
    );
  }

  const BUTTONS = [
    {
      id: 'manual',
      icon: BookOpenCheck,
      label: t('qr.btn.manual'),
      sub: t('qr.btn.manualSub'),
    },
    { id: 'device', icon: Info, label: t('qr.btn.device'), sub: t('qr.btn.deviceSub') },
    { id: 'contact', icon: Phone, label: t('qr.btn.contact'), sub: t('qr.btn.contactSub') },
  ];

  return (
    <div className="qr-page">
      <div className="qr-shell">
        <header className="qr-top">
          <Logo size={20} />
          {view !== 'menu' && (
            <button type="button" className="qr-back" onClick={() => setView('menu')}>
              <ChevronLeft size={15} /> {t('qr.back')}
            </button>
          )}
        </header>

        <div className="qr-hero">
          {asset.image ? (
            <img src={asset.image} alt={asset.name} />
          ) : (
            <span className="qr-hero-empty">{asset.model}</span>
          )}
        </div>

        <h1 className="qr-name">{asset.name}</h1>
        <p className="qr-model">
          {asset.model}
          {asset.classItemName ? ` · ${asset.classItemName}` : ''}
        </p>

        {/* Panels swap without an exit animation: the incoming panel must never
            wait on the outgoing one to finish, or a throttled tab can leave the
            page showing nothing at all. */}
        <div className="qr-views">
          {view === 'menu' && (
            <motion.div
              key="menu"
              className="qr-menu"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {BUTTONS.map((button) => {
                const Icon = button.icon;
                return (
                  <button
                    key={button.id}
                    type="button"
                    className="qr-btn"
                    onClick={() => setView(button.id)}
                  >
                    <span className="ic">
                      <Icon size={19} />
                    </span>
                    <span className="txt">
                      <b>{button.label}</b>
                      <em>{button.sub}</em>
                    </span>
                    <ChevronRight size={17} className="go" />
                  </button>
                );
              })}
            </motion.div>
          )}

          {view === 'manual' && (
            <Panel key="manual" title={t('qr.btn.manual')}>
              {asset.manual ? (
                <>
                  <p className="qr-panel-lede">{asset.manual.title}</p>
                  <Link className="btn btn-primary" to={`/manual/${asset.manual.id}`}>
                    <BookOpenCheck size={15} /> {t('product.manual.open')}
                  </Link>
                </>
              ) : (
                <p className="qr-panel-lede">{t('qr.manualNone')}</p>
              )}
            </Panel>
          )}

          {view === 'device' && (
            <DevicePanel
              key="device"
              asset={asset}
              statuses={reference.statuses}
              needsReason={reference.statusesNeedingReason || ['nosoz', 'yaroqsiz']}
              onUpdated={setAsset}
            />
          )}

          {view === 'contact' && (
            <Panel key="contact" title={t('qr.btn.contact')}>
              {asset.operator?.phone || asset.operator?.name ? (
                <div className="qr-operator">
                  <span className="av">{(asset.operator.name || '?').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <b>{asset.operator.name || t('qr.operator')}</b>
                    {asset.operator.note && <em>{asset.operator.note}</em>}
                    {asset.operator.phone && (
                      <a
                        className="btn btn-primary btn-sm"
                        href={`tel:${asset.operator.phone.replace(/[^\d+]/g, '')}`}
                      >
                        <Phone size={13} /> {asset.operator.phone}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="qr-panel-lede">{t('qr.noOperator')}</p>
              )}

              <div className="qr-channels">
                {(asset.contacts?.admins || []).map((a) => (
                  <a key={a.id} className="qr-channel" href={a.phoneHref}>
                    <Phone size={15} />
                    <span>
                      <b>{a.name}</b>
                      <em>{a.phone}</em>
                    </span>
                  </a>
                ))}
                {(asset.contacts?.channels || []).map((c) => {
                  const Icon = CHANNEL_ICONS[c.id] || Send;
                  return (
                    <a
                      key={c.id}
                      className="qr-channel"
                      href={c.url}
                      target={c.url.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                    >
                      <Icon size={15} />
                      <span>
                        <b>{c.label}</b>
                        <em>{c.handle}</em>
                      </span>
                    </a>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        <footer className="qr-foot">
          <MapPin size={12} /> {asset.organization}
          {asset.districtName ? ` · ${asset.districtName}` : ''}
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ title, children }) {
  return (
    <motion.section
      className="qr-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <h2>{title}</h2>
      {children}
    </motion.section>
  );
}

/**
 * The device panel. A visitor sees only what identifies the machine — photo,
 * name, model, serial and condition — and may change the condition; a faulty
 * or unusable machine has to be explained before the change is accepted.
 */
function DevicePanel({ asset, statuses, needsReason, onUpdated }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(asset.status);
  const [reason, setReason] = useState(asset.faultReason || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const mustExplain = needsReason.includes(status);
  const dirty = status !== asset.status || (mustExplain && reason !== (asset.faultReason || ''));

  const submit = async (event) => {
    event.preventDefault();
    if (mustExplain && !reason.trim()) {
      setError(t('mon.faultNeeded'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/qr/${asset.id}/status`, {
        method: 'PATCH',
        body: { status, reason: reason.trim() },
      });
      onUpdated({ ...asset, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const StatusIcon = STATUS_ICON[asset.status] || Info;

  return (
    <motion.section
      className="qr-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <h2>{t('qr.btn.device')}</h2>

      <div className="qr-facts">
        <div>
          <span>{t('mon.name')}</span>
          <b>{asset.name}</b>
        </div>
        <div>
          <span>{t('mon.model')}</span>
          <b>{asset.model}</b>
        </div>
        <div>
          <span>{t('mon.serial')}</span>
          <b>{asset.serial || '—'}</b>
        </div>
        <div>
          <span>{t('qr.status')}</span>
          <b className={`qr-status is-${asset.status}`}>
            <StatusIcon size={14} /> {t(`status.${asset.status}`)}
          </b>
        </div>
      </div>

      {asset.statusChangedAt && (
        <p className="qr-panel-note">
          {t('qr.lastChange')}: {new Date(asset.statusChangedAt).toLocaleString()}
        </p>
      )}

      <form className="qr-status-form" onSubmit={submit}>
        <h3>{t('qr.changeStatus')}</h3>
        <div className="qr-status-picks">
          {(statuses || []).map((s) => (
            <button
              key={s.id}
              type="button"
              className={`qr-status-pick is-${s.id}${status === s.id ? ' active' : ''}`}
              onClick={() => {
                setStatus(s.id);
                setSaved(false);
                setError('');
              }}
            >
              {t(`status.${s.id}`)}
            </button>
          ))}
        </div>

        {mustExplain && (
          <div className="field full">
            <label htmlFor="qr-reason">{t('mon.fault')}</label>
            <textarea
              id="qr-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSaved(false);
              }}
              placeholder={t('mon.faultPh')}
            />
          </div>
        )}

        {error && <div className="form-alert bad">{error}</div>}
        {saved && <div className="form-alert ok">{t('qr.saved')}</div>}

        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? t('common.saving') : t('qr.saveStatus')}
        </button>
      </form>
    </motion.section>
  );
}
