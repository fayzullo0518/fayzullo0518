import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import {
  Upload,
  Trash2,
  ImageOff,
  Paperclip,
  FileText,
  AlertTriangle,
  Pencil,
  ExternalLink,
  Printer,
} from 'lucide-react';

import MapPicker from './MapPicker.jsx';
import { api, uploadFile } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';
import { useReference, formatBytes } from '../../lib/reference.js';
import { qrUrl } from '../../lib/routes.js';

const EASE = [0.16, 1, 0.3, 1];
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

const EMPTY = {
  classGroup: '',
  classSection: '',
  classItem: '',
  images: [],
  manufacturer: '',
  manufacturerCountry: '',
  productionCountry: '',
  name: '',
  model: '',
  serial: '',
  contractFile: null,
  invoiceFile: null,
  producedAt: '',
  purchasedAt: '',
  warrantyUntil: '',
  soldAt: '',
  price: '',
  region: '',
  district: '',
  districtOther: '',
  organization: '',
  organizationNote: '',
  lat: '',
  lng: '',
  status: 'soz',
  faultReason: '',
  manualId: '',
};

/* ------------------------------------------------------------------ */
/* the extra window that opens when a machine is marked faulty         */
/* ------------------------------------------------------------------ */

function FaultDialog({ status, value, onSave, onCancel }) {
  const { t } = useI18n();
  const [reason, setReason] = useState(value || '');
  const [error, setError] = useState('');

  const save = () => {
    if (!reason.trim()) {
      setError(t('mon.faultNeeded'));
      return;
    }
    onSave(reason.trim());
  };

  return (
    <div className="adm-modal-bg adm-modal-bg-top" role="presentation">
      <motion.div
        className="adm-modal adm-modal-narrow"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: EASE }}
        role="dialog"
        aria-modal="true"
      >
        <h3>
          <AlertTriangle
            size={17}
            style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--warn)' }}
          />
          {t('mon.fault')}
        </h3>
        <p className="sub">
          {t('mon.status')}: <b>{t(`status.${status}`)}</b>
        </p>

        <div className="field full" style={{ marginTop: 12 }}>
          <label htmlFor="fault-reason">{t('mon.fault')}</label>
          <textarea
            id="fault-reason"
            autoFocus
            rows={5}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder={t('mon.faultPh')}
          />
        </div>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* a single document slot (contract, invoice)                          */
/* ------------------------------------------------------------------ */

function DocumentField({ label, file, onFile }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      onFile(await uploadFile(chosen, 'doc'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="as-doc is-file-only">
      <label className="as-doc-label">{label}</label>
      <div className="as-doc-file">
        <input
          ref={ref}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.rar,.7z"
          onChange={pick}
          hidden
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => ref.current?.click()}
          disabled={busy}
        >
          <Upload size={14} /> {busy ? t('mon.uploading') : t('mon.uploadOne')}
        </button>
        {file && (
          <span className="as-doc-chip">
            <FileText size={13} />
            <a href={file.url} target="_blank" rel="noreferrer" download={file.name}>
              {file.name}
            </a>
            <em>{formatBytes(file.size)}</em>
            <button type="button" onClick={() => onFile(null)} aria-label={t('mon.remove')}>
              <Trash2 size={12} />
            </button>
          </span>
        )}
        {error && <div className="form-alert bad">{error}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the monitoring record                                               */
/* ------------------------------------------------------------------ */

export default function AssetModal({ initial, products = [], manuals = [], onClose, onSaved }) {
  const { t } = useI18n();
  const reference = useReference();
  const editing = Boolean(initial?.id);
  const photosRef = useRef(null);

  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [fault, setFault] = useState(null); // { status, previous }
  const [uploading, setUploading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  /* ---------------- where it stands ---------------- */

  const regions = reference.regions || [];
  const districts = useMemo(
    () => regions.find((r) => r.id === form.region)?.districts || [],
    [regions, form.region],
  );

  /** picking a region invalidates the district under it */
  const pickRegion = (id) => setForm((f) => ({ ...f, region: id, district: '', districtOther: '' }));

  /* organisations already entered in this district, offered as suggestions */
  useEffect(() => {
    const params = new URLSearchParams();
    if (form.region) params.set('region', form.region);
    if (form.district && form.district !== 'other') params.set('district', form.district);
    api(`/admin/organizations?${params.toString()}`, { auth: true })
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, [form.region, form.district]);

  /* ---------------- classification cascade ---------------- */

  const groups = reference.classification || [];
  const sections = useMemo(
    () => groups.find((g) => g.id === form.classGroup)?.sections || [],
    [groups, form.classGroup],
  );
  const items = useMemo(
    () => sections.find((s) => s.id === form.classSection)?.items || [],
    [sections, form.classSection],
  );

  const pickGroup = (id) => setForm((f) => ({ ...f, classGroup: id, classSection: '', classItem: '' }));
  const pickSection = (id) => setForm((f) => ({ ...f, classSection: id, classItem: '' }));

  /* ---------------- photographs ---------------- */

  const usedBytes = (form.images || []).reduce((sum, img) => sum + (img.size || 0), 0);

  const addPhotos = async (event) => {
    const chosen = [...(event.target.files || [])];
    event.target.value = '';
    if (!chosen.length) return;

    setUploading(true);
    setError('');
    let running = usedBytes;
    const added = [];
    try {
      for (const file of chosen) {
        if (running + file.size > MAX_IMAGE_BYTES) {
          setError(t('mon.tooBig'));
          break;
        }
        const saved = await uploadFile(file, 'image');
        added.push(saved);
        running += saved.size;
      }
      if (added.length) set('images', [...(form.images || []), ...added]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const dropPhoto = (url) =>
    set('images', (form.images || []).filter((img) => img.url !== url));

  /* ---------------- condition ---------------- */

  const needsReason = (reference.statusesNeedingReason || ['nosoz', 'yaroqsiz']).includes(
    form.status,
  );

  const pickStatus = (next) => {
    const previous = form.status;
    if ((reference.statusesNeedingReason || ['nosoz', 'yaroqsiz']).includes(next)) {
      // a faulty machine needs an explanation — ask for it in its own window
      setForm((f) => ({ ...f, status: next }));
      setFault({ status: next, previous });
    } else {
      setForm((f) => ({ ...f, status: next, faultReason: '' }));
    }
  };

  /* ---------------- location ---------------- */

  const setPoint = (lat, lng) => setForm((f) => ({ ...f, lat, lng }));
  const clearPoint = () => setForm((f) => ({ ...f, lat: '', lng: '' }));

  /* ---------------- save ---------------- */

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = editing
        ? await api(`/admin/assets/${initial.id}`, { method: 'PATCH', body: form, auth: true })
        : await api('/admin/assets', { method: 'POST', body: form, auth: true });
      onSaved(saved, editing);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // the map opens over whichever region was picked
  const mapCenter = regions.find((r) => r.id === form.region)?.center || reference.mapCenter;

  return (
    <div className="adm-modal-bg" onClick={onClose} role="presentation">
      <motion.form
        className="adm-modal adm-modal-wide as-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h3>{editing ? t('mon.edit') : t('mon.add')}</h3>
        <p className="sub">{t('mon.sub')}</p>

        {/* ---------------- photographs ---------------- */}
        <div className="as-photos">
          <div className="as-photos-head">
            <span>{t('mon.photos')}</span>
            <em>{t('mon.sizeUsed', { used: formatBytes(usedBytes) })}</em>
          </div>

          <div className="as-photo-grid">
            {(form.images || []).map((img) => (
              <div className="as-photo" key={img.url}>
                <img src={img.url} alt={img.name || ''} />
                <button
                  type="button"
                  onClick={() => dropPhoto(img.url)}
                  aria-label={t('mon.remove')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {(form.images || []).length === 0 && (
              <span className="as-photo-empty">
                <ImageOff size={20} />
                {t('mon.photosHint')}
              </span>
            )}
          </div>

          <input
            ref={photosRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            onChange={addPhotos}
            hidden
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => photosRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={15} /> {uploading ? t('mon.uploading') : t('mon.upload')}
          </button>
        </div>

        {/* ---------------- classification ---------------- */}
        <div className="form-grid as-grid-3">
          <div className="field">
            <label htmlFor="as-g">{t('mon.class1')}</label>
            <select id="as-g" value={form.classGroup} onChange={(e) => pickGroup(e.target.value)}>
              <option value="">—</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="as-s">{t('mon.class2')}</label>
            <select
              id="as-s"
              value={form.classSection}
              onChange={(e) => pickSection(e.target.value)}
              disabled={!sections.length}
            >
              <option value="">—</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="as-i">{t('mon.class3')}</label>
            <select
              id="as-i"
              value={form.classItem}
              onChange={(e) => set('classItem', e.target.value)}
              disabled={!items.length}
            >
              <option value="">—</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------------- core details ---------------- */}
        <div className="as-legend">{t('mon.section.basic')}</div>

        <div className="form-grid as-grid-3">
          <div className="field">
            <label htmlFor="as-mf">{t('mon.manufacturer')}</label>
            <input
              id="as-mf"
              value={form.manufacturer}
              onChange={(e) => set('manufacturer', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-mfc">{t('mon.manufacturerCountry')}</label>
            <input
              id="as-mfc"
              value={form.manufacturerCountry}
              onChange={(e) => set('manufacturerCountry', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-pc">{t('mon.productionCountry')} *</label>
            <input
              id="as-pc"
              required
              value={form.productionCountry}
              onChange={(e) => set('productionCountry', e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="as-name">{t('mon.name')} *</label>
            <input
              id="as-name"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-model">{t('mon.model')} *</label>
            <input
              id="as-model"
              required
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-serial">{t('mon.serial')}</label>
            <input
              id="as-serial"
              value={form.serial}
              onChange={(e) => set('serial', e.target.value)}
            />
          </div>
        </div>

        {/* the numbers are gone; the documents themselves are still attached */}
        <DocumentField
          label={t('mon.contractFile')}
          file={form.contractFile}
          onFile={(f) => set('contractFile', f)}
        />
        <DocumentField
          label={t('mon.invoiceFile')}
          file={form.invoiceFile}
          onFile={(f) => set('invoiceFile', f)}
        />

        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-price">{t('mon.price')}</label>
            <input
              id="as-price"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="1 250 000 000 so‘m"
            />
          </div>
        </div>

        {/* ---------------- where it stands ---------------- */}
        <div className="as-legend">{t('mon.section.place')}</div>

        <div className="form-grid as-grid-3">
          <div className="field">
            <label htmlFor="as-region">{t('mon.region')} *</label>
            <select
              id="as-region"
              required
              value={form.region}
              onChange={(e) => pickRegion(e.target.value)}
            >
              <option value="">—</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="as-district">{t('mon.district')} *</label>
            <select
              id="as-district"
              required
              value={form.district}
              onChange={(e) => set('district', e.target.value)}
              disabled={!districts.length}
            >
              <option value="">—</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="as-org">{t('mon.org')} *</label>
            {/* pick one already in use, or type a name nobody has entered yet */}
            <input
              id="as-org"
              required
              list="as-org-list"
              value={form.organization}
              onChange={(e) => set('organization', e.target.value)}
              placeholder={t('mon.orgPh')}
              autoComplete="off"
            />
            <datalist id="as-org-list">
              {organizations.map((o) => (
                <option key={o.name} value={o.name} />
              ))}
            </datalist>
          </div>
        </div>

        {form.district === 'other' && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="as-dother">{t('mon.districtOther')} *</label>
              <input
                id="as-dother"
                required
                value={form.districtOther}
                onChange={(e) => set('districtOther', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="as-orgnote">{t('mon.orgNote')}</label>
            <input
              id="as-orgnote"
              value={form.organizationNote}
              onChange={(e) => set('organizationNote', e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-prod">{t('mon.produced')}</label>
            <input
              id="as-prod"
              type="date"
              value={form.producedAt}
              onChange={(e) => set('producedAt', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-purch">{t('mon.purchased')}</label>
            <input
              id="as-purch"
              type="date"
              value={form.purchasedAt}
              onChange={(e) => set('purchasedAt', e.target.value)}
            />
          </div>
        </div>

        {/* the warranty date sits immediately before the date of sale */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-warr">{t('mon.warranty')}</label>
            <input
              id="as-warr"
              type="date"
              value={form.warrantyUntil}
              onChange={(e) => set('warrantyUntil', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="as-sold">{t('mon.sold')}</label>
            <input
              id="as-sold"
              type="date"
              value={form.soldAt}
              onChange={(e) => set('soldAt', e.target.value)}
            />
          </div>
        </div>

        {/* ---------------- condition ---------------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-status">{t('mon.status')}</label>
            <select
              id="as-status"
              value={form.status}
              onChange={(e) => pickStatus(e.target.value)}
            >
              {(reference.statuses || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {t(`status.${s.id}`)}
                </option>
              ))}
            </select>
          </div>
          {needsReason && (
            <div className="field">
              <label>{t('mon.fault')}</label>
              <button
                type="button"
                className="as-fault-summary"
                onClick={() => setFault({ status: form.status, previous: form.status })}
              >
                <span>{form.faultReason || t('mon.faultPh')}</span>
                <Pencil size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ---------------- coordinates and map ---------------- */}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-lat">{t('mon.lat')}</label>
            <input
              id="as-lat"
              inputMode="decimal"
              value={form.lat ?? ''}
              onChange={(e) => set('lat', e.target.value)}
              placeholder="40.386400"
            />
          </div>
          <div className="field">
            <label htmlFor="as-lng">{t('mon.lng')}</label>
            <input
              id="as-lng"
              inputMode="decimal"
              value={form.lng ?? ''}
              onChange={(e) => set('lng', e.target.value)}
              placeholder="71.786400"
            />
          </div>
        </div>

        <MapPicker
          lat={form.lat}
          lng={form.lng}
          center={mapCenter}
          onPick={setPoint}
          onClear={clearPoint}
        />

        {/* The instruction stays: it is what the QR code's first button opens,
            and there is nowhere else to attach one from. */}
        <div className="as-legend">{t('mon.section.link')}</div>

        <div className="form-grid">
          <div className="field full">
            <label htmlFor="as-manual">{t('mon.linkManual')}</label>
            <select
              id="as-manual"
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

        <div className="mn-qr">
          {editing ? (
            <>
              <span className="qr-frame">
                <QRCode value={qrUrl(initial.id)} size={116} bgColor="#FFFFFF" fgColor="#101828" level="M" />
              </span>
              <div>
                <b>{t('mon.qr')}</b>
                <p>{t('mon.qrHint')}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <a
                    className="btn btn-ghost btn-sm"
                    href={`/q/${initial.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} /> {t('common.open')}
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => window.print()}
                  >
                    <Printer size={13} /> {t('manual.print')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="mn-hint" style={{ margin: 0 }}>
              <Paperclip size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {t('mon.qrAfterSave')}
            </div>
          )}
        </div>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </motion.form>

      {fault && (
        <FaultDialog
          status={fault.status}
          value={form.faultReason}
          onSave={(reason) => {
            setForm((f) => ({ ...f, faultReason: reason }));
            setFault(null);
          }}
          onCancel={() => {
            // cancelling puts the condition back the way it was
            setForm((f) => ({
              ...f,
              status: form.faultReason ? f.status : fault.previous,
            }));
            setFault(null);
          }}
        />
      )}
    </div>
  );
}
