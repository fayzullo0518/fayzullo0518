import { useState } from 'react';
import { motion } from 'motion/react';

import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

const SWATCHES = [
  '#3B5BFF', '#38D6E0', '#7C5CFF', '#F2596B',
  '#E86AA6', '#0FA3A0', '#F0A93B', '#57A773',
];

export default function CategoryModal({ initial, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    name: '',
    tagline: '',
    blurb: '',
    accent: SWATCHES[0],
    ...(initial || {}),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = editing
        ? await api(`/admin/categories/${initial.id}`, { method: 'PATCH', body: form, auth: true })
        : await api('/admin/categories', { method: 'POST', body: form, auth: true });
      onSaved(saved, editing);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-modal-bg" onClick={onClose} role="presentation">
      <motion.form
        className="adm-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h3>{editing ? t('cat.edit', { name: initial.name }) : t('cat.new')}</h3>
        <p className="sub">{editing ? t('cat.editSub') : t('cat.newSub')}</p>

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="c-name">{t('cat.name')} *</label>
            <input
              id="c-name"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('cat.namePh')}
            />
          </div>
          <div className="field full">
            <label htmlFor="c-tag">{t('cat.tagline')}</label>
            <input
              id="c-tag"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              placeholder={t('cat.taglinePh')}
            />
          </div>
          <div className="field full">
            <label htmlFor="c-blurb">{t('cat.desc')}</label>
            <textarea
              id="c-blurb"
              value={form.blurb}
              onChange={(e) => set('blurb', e.target.value)}
              placeholder={t('cat.descPh')}
            />
          </div>
          <div className="field full">
            <label>{t('cat.accent')}</label>
            <div className="cm-swatches">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`cm-swatch${form.accent === hex ? ' active' : ''}`}
                  style={{ background: hex }}
                  onClick={() => set('accent', hex)}
                  aria-label={hex}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : editing ? t('cat.save') : t('cat.create')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
