import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import {
  Plus,
  Trash2,
  Search,
  Check,
  ExternalLink,
  Printer,
  Upload,
  ImageOff,
} from 'lucide-react';

import { api, uploadFile } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

const EMPTY = {
  title: '',
  deviceModel: '',
  deviceName: '',
  language: 'uz',
  intro: '',
  contactName: '',
  contactPhone: '',
};

const EMPTY_BLOCK = { heading: '', body: '', image: '' };

/**
 * One step of the instruction: an optional photograph of the device, a
 * heading and the explaining text. The modal starts with a single block and
 * the “+” button adds as many as the instruction needs.
 */
function InstructionBlock({ index, block, onChange, onRemove, canRemove }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const saved = await uploadFile(file, 'image');
      onChange({ ...block, image: saved.url });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mn-block">
      <div className="mn-block-media">
        {block.image ? (
          <img src={block.image} alt="" />
        ) : (
          <span className="pm-empty">
            <ImageOff size={18} />
            {t('manual.blockImage')}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={pick}
          hidden
        />
        <div className="mn-block-media-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={13} /> {busy ? t('mon.uploading') : t('mon.uploadOne')}
          </button>
          {block.image && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange({ ...block, image: '' })}
            >
              {t('mon.remove')}
            </button>
          )}
        </div>
      </div>

      <div className="mn-block-body">
        <div className="mn-block-top">
          <input
            value={block.heading}
            onChange={(e) => onChange({ ...block, heading: e.target.value })}
            placeholder={`${index + 1}. ${t('manual.blockHeading')}`}
            aria-label={`${t('manual.blockHeading')} ${index + 1}`}
          />
          <button
            type="button"
            className="row-btn danger"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`${t('common.delete')} ${index + 1}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <textarea
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
          placeholder={t('manual.blockBody')}
          aria-label={`${t('manual.blockBody')} ${index + 1}`}
        />
        {error && <div className="form-alert bad">{error}</div>}
      </div>
    </div>
  );
}

/**
 * Write a service manual by hand and attach it to devices. The manual is not
 * listed anywhere public — the printed QR code is the only way in, plus the
 * page of a device it has been attached to.
 */
export default function ManualModal({ initial, products, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(initial?.id);

  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [sections, setSections] = useState(
    initial?.sections?.length
      ? initial.sections.map((s) => ({ ...EMPTY_BLOCK, ...s }))
      : [{ ...EMPTY_BLOCK }],
  );
  const [safety, setSafety] = useState(initial?.safety?.length ? [...initial.safety] : ['']);
  const [attached, setAttached] = useState(new Set(initial?.productIds || []));
  const [deviceQuery, setDeviceQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const matches = useMemo(() => {
    const q = deviceQuery.trim().toLowerCase();
    const list = q
      ? products.filter((p) => `${p.model} ${p.name}`.toLowerCase().includes(q))
      : products;
    // keep already-attached devices visible at the top
    const picked = products.filter((p) => attached.has(p.id));
    const rest = list.filter((p) => !attached.has(p.id)).slice(0, 40);
    return [...picked, ...rest];
  }, [products, deviceQuery, attached]);

  const toggleDevice = (id) =>
    setAttached((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const manualUrl = editing ? `${window.location.origin}/manual/${initial.id}` : '';

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        sections: sections.filter((s) => s.heading.trim() || s.body.trim() || s.image),
        safety: safety.filter((s) => s.trim()),
        productIds: [...attached],
      };
      const saved = editing
        ? await api(`/admin/manuals/${initial.id}`, { method: 'PATCH', body, auth: true })
        : await api('/admin/manuals', { method: 'POST', body, auth: true });
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
        transition={{ duration: 0.35, ease: EASE }}
      >
        <h3>{editing ? form.title || t('manual.title') : t('manual.new')}</h3>
        <p className="sub">{t('manual.sub')}</p>

        {/* ---------- basics ---------- */}
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="mn-title">{t('manual.title')} *</label>
            <input
              id="mn-title"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={t('manual.titlePh')}
            />
          </div>
          <div className="field">
            <label htmlFor="mn-model">{t('manual.deviceModel')}</label>
            <input
              id="mn-model"
              value={form.deviceModel}
              onChange={(e) => set('deviceModel', e.target.value)}
              placeholder="YSMRI-300"
            />
          </div>
          <div className="field">
            <label htmlFor="mn-name">{t('manual.deviceName')}</label>
            <input
              id="mn-name"
              value={form.deviceName}
              onChange={(e) => set('deviceName', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mn-lang">{t('nav.language')}</label>
            <select
              id="mn-lang"
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
            >
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="mn-intro">{t('manual.intro')}</label>
            <textarea
              id="mn-intro"
              value={form.intro}
              onChange={(e) => set('intro', e.target.value)}
              placeholder={t('manual.introPh')}
            />
          </div>
        </div>

        {/* ---------- instruction blocks ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>{t('manual.block')}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSections((rows) => [...rows, { ...EMPTY_BLOCK }])}
            >
              <Plus size={13} /> {t('manual.addBlock')}
            </button>
          </div>
          <p className="mn-hint">{t('manual.blocksHint')}</p>

          {sections.map((row, i) => (
            <InstructionBlock
              key={i}
              index={i}
              block={row}
              canRemove={sections.length > 1}
              onChange={(next) => setSections((rows) => rows.map((r, j) => (j === i ? next : r)))}
              onRemove={() => setSections((rows) => rows.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        {/* ---------- safety ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>{t('manual.safety')}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSafety((rows) => [...rows, ''])}
            >
              <Plus size={13} /> {t('manual.addSafety')}
            </button>
          </div>
          {safety.map((row, i) => (
            <div className="mn-safety-row" key={i}>
              <input
                value={row}
                onChange={(e) =>
                  setSafety((rows) => rows.map((r, j) => (j === i ? e.target.value : r)))
                }
                placeholder={t('manual.safetyPh')}
                aria-label={`${t('manual.safety')} ${i + 1}`}
              />
              <button
                type="button"
                className="row-btn danger"
                onClick={() => setSafety((rows) => rows.filter((_, j) => j !== i))}
                aria-label={`${t('common.delete')} ${i + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* ---------- responsible person ---------- */}
        <div className="form-grid" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="mn-cname">{t('manual.contactName')}</label>
            <input
              id="mn-cname"
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              placeholder="Fayzullo Ergashev"
            />
          </div>
          <div className="field">
            <label htmlFor="mn-cphone">{t('manual.contactPhone')}</label>
            <input
              id="mn-cphone"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              placeholder="+998 88 210 09 24"
            />
          </div>
        </div>

        {/* ---------- QR ---------- */}
        {editing && (
          <div className="mn-qr">
            <span className="qr-frame">
              <QRCode value={manualUrl} size={116} bgColor="#FFFFFF" fgColor="#101828" level="M" />
            </span>
            <div>
              <b>{t('manual.qr')}</b>
              <p>{t('manual.qrHint')}</p>
              <div className="mn-qr-name">
                <b>{form.contactName || '—'}</b>
                <span>{form.contactPhone || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <a className="btn btn-ghost btn-sm" href={`/manual/${initial.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} /> {t('common.open')}
                </a>
                <a
                  className="btn btn-ghost btn-sm"
                  href={`/manual/${initial.id}?print=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer size={13} /> {t('manual.print')}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ---------- attach to devices ---------- */}
        <div className="pm-specs">
          <div className="pm-specs-head">
            <span>
              {t('manual.attach')} · {attached.size}
            </span>
          </div>
          <p className="mn-hint">{t('manual.attachHint')}</p>
          <div className="search-field" style={{ maxWidth: 'none', height: 40, marginBottom: 10 }}>
            <Search size={15} color="var(--text-3)" />
            <input
              value={deviceQuery}
              onChange={(e) => setDeviceQuery(e.target.value)}
              placeholder={t('market.search')}
              aria-label={t('market.search')}
            />
          </div>
          <div className="mn-devices">
            {matches.map((p) => {
              const on = attached.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`mn-device${on ? ' on' : ''}`}
                  onClick={() => toggleDevice(p.id)}
                >
                  <span className="thumb">
                    <img src={p.image} alt="" />
                  </span>
                  <span className="txt">
                    <b>{p.model}</b>
                    <em>{p.name}</em>
                  </span>
                  <span className="box">{on && <Check size={13} />}</span>
                </button>
              );
            })}
            {matches.length === 0 && <div className="adm-empty">{t('market.empty.t')}</div>}
          </div>
        </div>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
