import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Trash2,
  Plus,
  Upload,
  FileSpreadsheet,
  MoreVertical,
  QrCode,
  Eye,
  History,
  Pencil,
  ChevronUp,
  ChevronDown,
  ImageIcon,
} from 'lucide-react';

import { api, downloadFile } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';
import { useReference } from '../../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];
const PER_PAGE = 15;

const EMPTY_FILTERS = {
  serial: '',
  producedAt: '',
  classGroup: 'all',
  classSection: 'all',
  classItem: 'all',
  region: 'all',
  district: 'all',
  organization: 'all',
  manufacturerCountry: '',
  status: 'all',
};

/* ------------------------------------------------------------------ */
/* the ⋮ menu on every row                                             */
/* ------------------------------------------------------------------ */

function RowMenu({ asset, canEdit, onQr, onView, onHistory, onEdit, onDelete }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  const items = [
    { id: 'qr', icon: QrCode, label: t('mon.row.qr'), run: () => onQr(asset), tone: 'accent' },
    { id: 'view', icon: Eye, label: t('mon.row.view'), run: () => onView(asset), tone: 'ok' },
    {
      id: 'history',
      icon: History,
      label: t('mon.row.history'),
      run: () => onHistory(asset),
      tone: 'info',
    },
    ...(canEdit
      ? [
          { id: 'edit', icon: Pencil, label: t('mon.row.edit'), run: () => onEdit(asset), tone: 'warn' },
          {
            id: 'delete',
            icon: Trash2,
            label: t('common.delete'),
            run: () => onDelete(asset),
            tone: 'bad',
          },
        ]
      : []),
  ];

  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="row-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('mon.col.actions')}
      >
        <MoreVertical size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="row-menu-pop"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`row-menu-item is-${item.tone}`}
                  onClick={() => {
                    setOpen(false);
                    item.run();
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */

export default function DeviceRegistry({
  canEdit,
  isAdmin,
  onCreate,
  onEdit,
  onView,
  onHistory,
  onQr,
  onDelete,
  refreshKey,
}) {
  const { t } = useI18n();
  const reference = useReference();

  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [organizations, setOrganizations] = useState([]);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(applied)) {
      if (value && value !== 'all') params.set(key, value);
    }
    return params;
  }, [applied]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    api(`/admin/assets?${params.toString()}`, { auth: true })
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
        setGrandTotal(data.grandTotal);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, page]);

  useEffect(load, [load, refreshKey]);
  useEffect(() => setPage(1), [applied]);

  /* the two dropdowns built from what has actually been entered */
  useEffect(() => {
    api('/admin/organizations', { auth: true })
      .then((list) => setOrganizations(list))
      .catch(() => setOrganizations([]));
  }, [refreshKey]);

  const groups = reference.classification || [];
  const sections = groups.find((g) => g.id === draft.classGroup)?.sections || [];
  const items = sections.find((s) => s.id === draft.classSection)?.items || [];
  const regions = reference.regions || [];
  const districts = regions.find((r) => r.id === draft.region)?.districts || [];

  const set = (key, value) =>
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'classGroup') {
        next.classSection = 'all';
        next.classItem = 'all';
      }
      if (key === 'classSection') next.classItem = 'all';
      if (key === 'region') next.district = 'all';
      return next;
    });

  const exportXlsx = async (path, filename, tag) => {
    setExporting(tag);
    setError('');
    try {
      await downloadFile(`${path}?${query.toString()}`, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting('');
    }
  };

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mon-registry">
      {/* ---------------- search ---------------- */}
      <div className="adm-panel reg-search">
        <div className="adm-panel-head">
          <div>
            <h2>{t('mon.registry')}</h2>
          </div>
        </div>

        <div className="reg-row">
          <div className="field">
            <input
              value={draft.serial}
              onChange={(e) => set('serial', e.target.value)}
              placeholder={t('mon.serial')}
              aria-label={t('mon.serial')}
            />
          </div>
          <div className="field">
            <input
              type="date"
              value={draft.producedAt}
              onChange={(e) => set('producedAt', e.target.value)}
              aria-label={t('mon.produced')}
            />
          </div>
        </div>

        <button type="button" className="reg-toggle" onClick={() => setShowMore((v) => !v)}>
          {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showMore ? t('mon.filters.collapse') : t('mon.filters.more')}
        </button>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div className="as-legend">{t('mon.filters.extra')}</div>

              <div className="reg-row is-three">
                <select value={draft.classGroup} onChange={(e) => set('classGroup', e.target.value)}>
                  <option value="all">{t('mon.class1')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.classSection}
                  onChange={(e) => set('classSection', e.target.value)}
                  disabled={!sections.length}
                >
                  <option value="all">{t('mon.class2')}</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.classItem}
                  onChange={(e) => set('classItem', e.target.value)}
                  disabled={!items.length}
                >
                  <option value="all">{t('mon.class3')}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>

                <select value={draft.region} onChange={(e) => set('region', e.target.value)}>
                  <option value="all">{t('mon.region')}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.district}
                  onChange={(e) => set('district', e.target.value)}
                  disabled={!districts.length}
                >
                  <option value="all">{t('mon.district')}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.organization}
                  onChange={(e) => set('organization', e.target.value)}
                >
                  <option value="all">{t('mon.org')}</option>
                  {organizations.map((o) => (
                    <option key={o.name} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>

                <input
                  value={draft.manufacturerCountry}
                  onChange={(e) => set('manufacturerCountry', e.target.value)}
                  placeholder={t('mon.manufacturerCountry')}
                  aria-label={t('mon.manufacturerCountry')}
                />

                <select value={draft.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="all">{t('mon.status')}</option>
                  {(reference.statuses || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(`status.${s.id}`)}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="reg-actions">
          <button type="button" className="btn btn-primary" onClick={() => setApplied(draft)}>
            <Search size={15} /> {t('mon.search.btn')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
            }}
          >
            <Trash2 size={15} /> {t('mon.search.clear')}
          </button>
        </div>
      </div>

      {/* ---------------- results ---------------- */}
      <div className="adm-panel">
        <div className="adm-panel-head">
          <div>
            <h2>{t('mon.title')}</h2>
            <p>
              {total.toLocaleString('uz-UZ')} / {grandTotal.toLocaleString('uz-UZ')}
            </p>
          </div>
          <div className="reg-toolbar">
            {/* the workbook is an administrator tool — managers never see it */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    exportXlsx('/admin/assets/export.xlsx', 'apparat-monitoringi.xlsx', 'export')
                  }
                  disabled={exporting === 'export'}
                >
                  <Upload size={14} /> {exporting === 'export' ? t('mon.exporting') : t('mon.export.btn')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    exportXlsx('/admin/assets/export.xlsx', 'hisobot.xlsx', 'report')
                  }
                  disabled={exporting === 'report'}
                >
                  <FileSpreadsheet size={14} />{' '}
                  {exporting === 'report' ? t('mon.exporting') : t('mon.report')}
                </button>
              </>
            )}
            {canEdit && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
                <Plus size={14} /> {t('mon.create')}
              </button>
            )}
          </div>
        </div>

        {error && <div className="form-alert bad">{error}</div>}

        <div className="adm-table-wrap">
          <table className="adm-table reg-table">
            <thead>
              <tr>
                <th>{t('mon.name')}</th>
                <th>{t('mon.model')}</th>
                <th>{t('mon.col.status')}</th>
                <th>{t('mon.org')}</th>
                <th>{t('mon.col.classType')}</th>
                <th>{t('mon.col.created')}</th>
                <th>{t('mon.col.createdBy')}</th>
                <th>{t('mon.col.photo')}</th>
                <th>{t('mon.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="mono">{a.model}</td>
                  <td>
                    <span className={`tag mon-tag is-${a.status}`}>{t(`status.${a.status}`)}</span>
                  </td>
                  <td style={{ color: 'var(--accent)' }}>{a.organization}</td>
                  <td style={{ color: 'var(--text-2)', maxWidth: 240 }}>{a.classPath || '—'}</td>
                  <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {(a.createdAt || '').slice(0, 10)}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{a.createdBy || '—'}</td>
                  <td>
                    {a.images?.[0]?.url ? (
                      <button
                        type="button"
                        className="reg-photo"
                        onClick={() => onView(a)}
                        aria-label={t('mon.col.photo')}
                      >
                        <ImageIcon size={15} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-3)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <RowMenu
                      asset={a}
                      canEdit={canEdit}
                      onQr={onQr}
                      onView={onView}
                      onHistory={onHistory}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && <div className="adm-empty">{t('mon.empty')}</div>}
          {loading && <div className="adm-empty">{t('market.loading')}</div>}
        </div>

        <div className="adm-pager">
          <span>
            {total.toLocaleString('uz-UZ')} {t('home.cats.devices')}
          </span>
          <div className="pager-btns">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              ‹
            </button>
            <button type="button" className="active">
              {page}
            </button>
            <span style={{ alignSelf: 'center', color: 'var(--text-3)', fontSize: 12 }}>/ {pages}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
