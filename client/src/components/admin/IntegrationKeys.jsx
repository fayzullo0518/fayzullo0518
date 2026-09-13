import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Copy, Check, ShieldCheck, ShieldOff, KeyRound, Plug } from 'lucide-react';

import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

/**
 * Integratsiya — the keys that let another website read this one.
 *
 * A key's plaintext exists for exactly one render: the server returns it on
 * creation and stores only a hash, so the panel shows it once with a copy
 * button and never again.
 */
export default function IntegrationKeys({ isSuperAdmin }) {
  const { t } = useI18n();

  const [keys, setKeys] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', origin: '', scopes: [] });
  const [fresh, setFresh] = useState(null); // the plaintext, shown once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api('/admin/integration/keys', { auth: true }),
      api('/admin/integration/scopes', { auth: true }),
    ])
      .then(([k, s]) => {
        setKeys(k);
        setScopes(s);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const toggleScope = (id) =>
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(id) ? f.scopes.filter((s) => s !== id) : [...f.scopes, id],
    }));

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await api('/admin/integration/keys', { method: 'POST', body: form, auth: true });
      setFresh(saved);
      setForm({ name: '', origin: '', scopes: [] });
      setCreating(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (key, status) => {
    try {
      await api(`/admin/integration/keys/${key.id}`, { method: 'PATCH', body: { status }, auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (key) => {
    if (!window.confirm(t('admin.confirmDelete', { name: key.name }))) return;
    try {
      await api(`/admin/integration/keys/${key.id}`, { method: 'DELETE', auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(fresh.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be blocked — the key is on screen */
    }
  };

  const base = `${window.location.origin}/api/v1`;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>{t('intg.title')}</h2>
          <p>{t('intg.sub')}</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus size={14} /> {t('intg.new')}
          </button>
        )}
      </div>

      {error && <div className="form-alert bad">{error}</div>}

      {/* ---------- the plaintext, this one time ---------- */}
      <AnimatePresence>
        {fresh && (
          <motion.div
            className="intg-fresh"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div>
              <b>
                <KeyRound size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {fresh.name}
              </b>
              <p>{t('intg.onceWarning')}</p>
            </div>
            <button type="button" className="intg-key" onClick={copyKey}>
              <code>{fresh.key}</code>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFresh(null)}>
              {t('intg.hide')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- new key ---------- */}
      <AnimatePresence initial={false}>
        {creating && (
          <motion.form
            onSubmit={create}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="form-grid" style={{ padding: '0 18px' }}>
              <div className="field">
                <label htmlFor="ik-name">{t('intg.name')} *</label>
                <input
                  id="ik-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="medservis.uz"
                />
              </div>
              <div className="field">
                <label htmlFor="ik-origin">{t('intg.origin')}</label>
                <input
                  id="ik-origin"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="https://medservis.uz"
                />
              </div>
              <div className="field full">
                <label>{t('intg.scopes')} *</label>
                <div className="intg-scopes">
                  {scopes.map((scope) => (
                    <label key={scope.id} className="intg-scope">
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                      />
                      <span>
                        <b>{scope.name}</b>
                        <code>{scope.id}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="adm-modal-actions" style={{ padding: '0 18px 18px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('common.saving') : t('intg.create')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ---------- existing keys ---------- */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t('intg.name')}</th>
              <th>{t('intg.scopes')}</th>
              <th>{t('intg.origin')}</th>
              <th>{t('intg.requests')}</th>
              <th>{t('intg.lastUsed')}</th>
              <th>{t('admin.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>
                  <span className="cell-user">
                    <span className="av">
                      <Plug size={14} />
                    </span>
                    <span>
                      <b>{key.name}</b>
                      <span className="mono">gmn_{key.prefix}_•••</span>
                    </span>
                  </span>
                </td>
                <td>
                  <div className="intg-chips">
                    {key.scopes.map((s) => (
                      <code key={s}>{s}</code>
                    ))}
                  </div>
                </td>
                <td style={{ color: 'var(--text-2)' }}>{key.origin || '—'}</td>
                <td>{key.requests || 0}</td>
                <td style={{ color: 'var(--text-2)' }}>
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '—'}
                </td>
                <td>
                  <span className={`tag ${key.status === 'active' ? 'tag-won' : 'tag-lost'}`}>
                    {t(`intg.status.${key.status}`)}
                  </span>
                </td>
                <td>
                  {isSuperAdmin && (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="row-btn"
                        onClick={() => setStatus(key, key.status === 'active' ? 'suspended' : 'active')}
                        aria-label={t('admin.status')}
                      >
                        {key.status === 'active' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>
                      <button
                        type="button"
                        className="row-btn danger"
                        onClick={() => remove(key)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {keys.length === 0 && <div className="adm-empty">{t('intg.empty')}</div>}
      </div>

      {/* ---------- how a partner uses it ---------- */}
      <div className="intg-docs">
        <h3>{t('intg.howto')}</h3>
        <pre>
          <code>{`curl -H "X-API-Key: gmn_..." \\
  ${base}/products?limit=20

# mavjud yo‘nalishlar:
GET  ${base}/categories        # catalog:read
GET  ${base}/products          # catalog:read
GET  ${base}/products/:id      # catalog:read
GET  ${base}/manuals/:id       # manuals:read
GET  ${base}/assets            # assets:read
GET  ${base}/assets/summary    # assets:read
POST ${base}/inquiries         # inquiries:write`}</code>
        </pre>
        <p className="mn-hint">{t('intg.corsHint')}</p>
      </div>
    </div>
  );
}
