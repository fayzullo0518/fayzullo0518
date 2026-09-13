import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, AlertTriangle, Check } from 'lucide-react';

import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];
const POLL_MS = 15000;

const ICON = { soz: CheckCircle2, nosoz: AlertTriangle, yaroqsiz: AlertTriangle };

/**
 * Condition changes arrive here.
 *
 * Every open panel polls the same feed, so a machine marked faulty from a
 * printed QR label shows up on every administrator's screen within a few
 * seconds — and, when the browser allows it, as a desktop notification too.
 */
export default function NotificationBell({ onOpenAsset }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const seen = useRef(new Set());
  const primed = useRef(false);

  const poll = useCallback(async () => {
    try {
      const data = await api('/admin/notifications', { auth: true });
      setItems(data.items || []);
      setUnread(data.unread || 0);

      // announce only what arrived after this panel was opened
      const fresh = (data.items || []).filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of data.items || []) seen.current.add(n.id);
      if (primed.current && fresh.length && window.Notification?.permission === 'granted') {
        for (const n of fresh.slice(0, 3)) {
          new window.Notification(t('ntf.status', { model: n.assetModel || n.assetName }), {
            body: `${n.organization || ''} · ${n.from} → ${n.to}${n.reason ? ` — ${n.reason}` : ''}`,
            tag: n.id,
          });
        }
      }
      primed.current = true;
    } catch {
      /* a dropped poll is not worth an error banner — the next one will do */
    }
  }, [t]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async () => {
    try {
      const data = await api('/admin/notifications/read', { method: 'POST', body: {}, auth: true });
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore — the badge simply stays until the next poll */
    }
  };

  return (
    <div className="ntf" ref={ref}>
      <button
        type="button"
        className="icon-btn ntf-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('ntf.title')}
        aria-expanded={open}
      >
        <Bell size={16} />
        {unread > 0 && <span className="ntf-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="ntf-menu"
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div className="ntf-head">
              <b>{t('ntf.title')}</b>
              {items.length > 0 && (
                <button type="button" onClick={markRead}>
                  <Check size={12} /> {t('ntf.markRead')}
                </button>
              )}
            </div>

            <div className="ntf-list">
              {items.map((n) => {
                const Icon = ICON[n.to] || Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`ntf-item${n.read ? '' : ' is-new'}`}
                    onClick={() => {
                      setOpen(false);
                      onOpenAsset?.(n.assetId);
                    }}
                  >
                    <span className={`ntf-ico is-${n.to}`}>
                      <Icon size={14} />
                    </span>
                    <span className="ntf-text">
                      <b>{t('ntf.status', { model: n.assetModel || n.assetName })}</b>
                      <em>
                        {t(`status.${n.from}`)} → {t(`status.${n.to}`)}
                        {n.organization ? ` · ${n.organization}` : ''}
                      </em>
                      {n.reason && <span className="why">{n.reason}</span>}
                      <time>
                        {new Date(n.at).toLocaleString()} · {t('ntf.by', { actor: n.actor || '—' })}
                      </time>
                    </span>
                  </button>
                );
              })}
              {items.length === 0 && <div className="adm-empty">{t('ntf.empty')}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
