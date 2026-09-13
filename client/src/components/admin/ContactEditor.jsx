import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, Save } from 'lucide-react';
import QRCode from 'react-qr-code';

import { api } from '../../lib/api.js';
import { invalidateContacts } from '../../lib/contact.js';
import { useI18n } from '../../lib/i18n.jsx';

/** Lets an administrator rewrite everything the public contact page shows. */
export default function ContactEditor({ canEdit, onSaved }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/contacts')
      .then((c) => setData({ ...c, admins: [...c.admins], channels: [...c.channels] }))
      .catch((err) => setMsg({ ok: false, text: err.message }));
  }, []);

  if (!data) {
    return <div className="adm-panel"><div className="adm-empty">{t('market.loading')}</div></div>;
  }

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const setAdmin = (i, key, value) =>
    setData((d) => ({
      ...d,
      admins: d.admins.map((a, j) => (j === i ? { ...a, [key]: value } : a)),
    }));
  const setChannel = (i, key, value) =>
    setData((d) => ({
      ...d,
      channels: d.channels.map((c, j) => (j === i ? { ...c, [key]: value } : c)),
    }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const saved = await api('/admin/contacts', { method: 'PUT', body: data, auth: true });
      setData({ ...saved, admins: [...saved.admins], channels: [...saved.channels] });
      invalidateContacts();
      setMsg({ ok: true, text: `${t('common.save')} ✓` });
      onSaved?.(saved);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-panel" onSubmit={save}>
      <div className="adm-panel-head">
        <div>
          <h2>{t('admin.contactPage')}</h2>
          <p>{t('contact.edit')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost btn-sm" to="/contact" target="_blank">
            <ExternalLink size={13} /> {t('common.open')}
          </Link>
          {canEdit && (
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              <Save size={13} /> {busy ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '4px 18px 22px' }}>
        {!canEdit && (
          <div className="form-alert bad" style={{ marginBottom: 16 }}>{t('ce.noPerm')}</div>
        )}

        {/* ---------- brand ---------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ct-brand">{t('ce.brand')}</label>
            <input
              id="ct-brand"
              disabled={!canEdit}
              value={data.brand}
              onChange={(e) => set('brand', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ct-legal">{t('ce.legal')}</label>
            <input
              id="ct-legal"
              disabled={!canEdit}
              value={data.legal}
              onChange={(e) => set('legal', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ct-tag">{t('ce.tagline')}</label>
            <input
              id="ct-tag"
              disabled={!canEdit}
              value={data.tagline}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ct-addr">{t('ce.address')}</label>
            <input
              id="ct-addr"
              disabled={!canEdit}
              value={data.address || ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </div>
        </div>

        {/* ---------- administrators ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>{t('contact.admins.t')}</span>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  set('admins', [...data.admins, { id: '', name: '', role: '', phone: '' }])
                }
              >
                <Plus size={13} /> {t('common.add')}
              </button>
            )}
          </div>

          {data.admins.map((a, i) => (
            <div className="ct-row" key={i}>
              <input
                disabled={!canEdit}
                value={a.name}
                onChange={(e) => setAdmin(i, 'name', e.target.value)}
                placeholder={t('contact.form.name')}
                aria-label={`${t('contact.form.name')} ${i + 1}`}
              />
              <input
                disabled={!canEdit}
                value={a.role}
                onChange={(e) => setAdmin(i, 'role', e.target.value)}
                placeholder={t('ce.rolePh')}
                aria-label={`${t('ce.role')} ${i + 1}`}
              />
              <input
                disabled={!canEdit}
                value={a.phone}
                onChange={(e) => setAdmin(i, 'phone', e.target.value)}
                placeholder="+998 …"
                aria-label={`${t('contact.form.phone')} ${i + 1}`}
              />
              {canEdit && (
                <button
                  type="button"
                  className="row-btn danger"
                  onClick={() => set('admins', data.admins.filter((_, j) => j !== i))}
                  aria-label={`${t('common.delete')} ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ---------- channels ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>{t('contact.qr.t')}</span>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  set('channels', [...data.channels, { id: '', label: '', handle: '', url: '' }])
                }
              >
                <Plus size={13} /> {t('common.add')}
              </button>
            )}
          </div>

          {data.channels.map((c, i) => (
            <div className="ct-row ct-row-channel" key={i}>
              <input
                disabled={!canEdit}
                value={c.label}
                onChange={(e) => setChannel(i, 'label', e.target.value)}
                placeholder="Instagram"
                aria-label={`${t('ce.label')} ${i + 1}`}
              />
              <input
                disabled={!canEdit}
                value={c.handle}
                onChange={(e) => setChannel(i, 'handle', e.target.value)}
                placeholder="@medservis.uz"
                aria-label={`${t('ce.handle')} ${i + 1}`}
              />
              <input
                disabled={!canEdit}
                value={c.url}
                onChange={(e) => setChannel(i, 'url', e.target.value)}
                placeholder="https://…"
                aria-label={`${t('ce.url')} ${i + 1}`}
              />
              <span className="ct-qr">
                {c.url ? (
                  <QRCode value={c.url} size={38} bgColor="#FFFFFF" fgColor="#101828" level="L" />
                ) : null}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="row-btn danger"
                  onClick={() => set('channels', data.channels.filter((_, j) => j !== i))}
                  aria-label={`${t('common.delete')} ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {msg && <div className={`form-alert ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
      </div>
    </form>
  );
}
