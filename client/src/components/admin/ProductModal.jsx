import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Plus, Trash2, ImageOff } from 'lucide-react';

import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';
import { useReference } from '../../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];
const PLACEHOLDER = '/products/placeholder.svg';

const EMPTY = {
  model: '',
  name: '',
  category: '',
  subcategory: '',
  summary: '',
  image: '',
  availability: 'In stock',
  leadTime: '2–3 weeks',
  warranty: '24 months',
  price: '',
  featured: false,
  manualId: '',
};

/**
 * Create or edit a device. Photos are uploaded to the API as base64 data URLs
 * and served back from /uploads, so nothing has to be copied by hand.
 */
export default function ProductModal({ initial, categories, manuals = [], onClose, onSaved }) {
  const { t, tr, tCat } = useI18n();
  const { specTemplate } = useReference();
  const editing = Boolean(initial?.id);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    ...EMPTY,
    category: categories[0]?.id || '',
    ...(initial || {}),
  });
  /* the rows every device shares — same labels everywhere, values per device */
  const [standard, setStandard] = useState(() => ({ ...(initial?.standard || {}) }));
  const [specs, setSpecs] = useState(
    initial?.specs?.length ? initial.specs.map((s) => ({ ...s })) : [{ label: '', value: '' }],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError(t('dev.imgTooBig'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(t('dev.readFail')));
        reader.readAsDataURL(file);
      });
      const { url } = await api('/admin/uploads', {
        method: 'POST',
        body: { dataUrl },
        auth: true,
      });
      set('image', url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        standard,
        specs: specs.filter((s) => s.label.trim() && s.value.trim()),
      };
      const saved = editing
        ? await api(`/admin/products/${initial.id}`, { method: 'PATCH', body, auth: true })
        : await api('/admin/products', { method: 'POST', body, auth: true });
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
        className="adm-modal adm-modal-wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h3>{editing ? t('dev.edit', { model: initial.model }) : t('dev.add')}</h3>
        <p className="sub">{editing ? t('dev.editSub') : t('dev.addSub')}</p>

        {/* ---------- photo ---------- */}
        <div className="pm-photo">
          <div className="pm-preview">
            {form.image ? (
              <img src={form.image} alt="" />
            ) : (
              <span className="pm-empty">
                <ImageOff size={20} />
                {t('dev.photoNone')}
              </span>
            )}
          </div>
          <div className="pm-photo-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={pickImage}
              hidden
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} /> {uploading ? t('dev.photoUploading') : t('dev.photoUpload')}
            </button>
            {form.image && form.image !== PLACEHOLDER && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('image', '')}>
                {t('dev.photoRemove')}
              </button>
            )}
            <label className="field" style={{ marginTop: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-3)',
                }}
              >
                {t('dev.photoUrl')}
              </span>
              <input
                value={form.image}
                onChange={(e) => set('image', e.target.value)}
                placeholder="/uploads/… , https://…"
              />
            </label>
          </div>
        </div>

        {/* ---------- core fields ---------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="p-model">{t('dev.model')} *</label>
            <input
              id="p-model"
              required
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder="YSMRI-300"
            />
          </div>
          <div className="field">
            <label htmlFor="p-name">{t('dev.name')} *</label>
            <input
              id="p-name"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="3.0T Superconducting MRI System"
            />
          </div>
          <div className="field">
            <label htmlFor="p-cat">{t('dev.catalogue')} *</label>
            <select
              id="p-cat"
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {tCat(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-sub">{t('dev.type')}</label>
            <input
              id="p-sub"
              value={form.subcategory}
              onChange={(e) => set('subcategory', e.target.value)}
              placeholder={t('dev.typePh')}
            />
          </div>
          <div className="field full">
            <label htmlFor="p-summary">{t('dev.summary')}</label>
            <textarea
              id="p-summary"
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder={t('dev.summaryPh')}
            />
          </div>
          <div className="field">
            <label htmlFor="p-avail">{t('product.availability')}</label>
            <select
              id="p-avail"
              value={form.availability}
              onChange={(e) => set('availability', e.target.value)}
            >
              <option value="In stock">{t('market.inStock')}</option>
              <option value="On order">{t('market.onOrder')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-lead">{t('product.leadTime')}</label>
            <input id="p-lead" value={form.leadTime} onChange={(e) => set('leadTime', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p-warranty">{t('product.warranty')}</label>
            <input
              id="p-warranty"
              value={form.warranty}
              onChange={(e) => set('warranty', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="p-price">
              {t('dev.price')} ({t('common.optional')})
            </label>
            <input
              id="p-price"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder={t('dev.pricePh')}
            />
          </div>
          <div className="field full">
            <label htmlFor="p-manual">{t('dev.manual')}</label>
            <select
              id="p-manual"
              value={form.manualId || ''}
              onChange={(e) => set('manualId', e.target.value)}
            >
              <option value="">—</option>
              {manuals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------- the standard sheet, identical on every device ---------- */}
        <div className="pm-specs pm-standard">
          <div className="pm-specs-head">
            <span>{t('spec.standard')}</span>
          </div>
          <p className="mn-hint">{t('spec.standardHint')}</p>
          <div className="pm-standard-grid">
            {specTemplate.map((row) => (
              <label className="field" key={row.key}>
                <span className="pm-standard-label">{tr(`speclabel.${row.key}`, row.label)}</span>
                <input
                  value={standard[row.key] || ''}
                  onChange={(e) => setStandard((s) => ({ ...s, [row.key]: e.target.value }))}
                  placeholder={row.placeholder}
                />
              </label>
            ))}
          </div>
        </div>

        {/* ---------- rows that belong to this device alone ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>{t('spec.extra')}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSpecs((rows) => [...rows, { label: '', value: '' }])}
            >
              <Plus size={13} /> {t('dev.addRow')}
            </button>
          </div>
          {specs.map((row, i) => (
            <div className="pm-spec-row" key={i}>
              <input
                value={row.label}
                onChange={(e) =>
                  setSpecs((rows) => rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                }
                placeholder={t('dev.specLabelPh')}
                aria-label={`${t('dev.specs')} ${i + 1}`}
              />
              <input
                value={row.value}
                onChange={(e) =>
                  setSpecs((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                }
                placeholder={t('dev.specValuePh')}
                aria-label={`${t('dev.specs')} ${i + 1} — ${t('common.edit')}`}
              />
              <button
                type="button"
                className="row-btn danger"
                onClick={() => setSpecs((rows) => rows.filter((_, j) => j !== i))}
                aria-label={`${t('common.delete')} ${i + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <label className="pm-check">
          <input
            type="checkbox"
            checked={Boolean(form.featured)}
            onChange={(e) => set('featured', e.target.checked)}
          />
          {t('dev.feature')}
        </label>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            {busy ? t('common.saving') : editing ? t('dev.saveEdit') : t('dev.saveNew')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
