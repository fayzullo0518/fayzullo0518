import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Boxes, CheckCircle2, Wrench, Ban, Map as MapIcon, Eye, X } from 'lucide-react';

import AssetMap from './AssetMap.jsx';
import { api } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.jsx';
import { useReference } from '../../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];

const TONE = {
  soz: 'var(--ok)',
  nosoz: 'var(--warn)',
  yaroqsiz: 'var(--danger)',
};

/* ------------------------------------------------------------------ */
/* donut                                                               */
/* ------------------------------------------------------------------ */

/**
 * A ring drawn with four stroked arcs — no charting library, and it reads
 * correctly in both themes because every colour is a token.
 */
function Donut({ slices, total, caption }) {
  const size = 210;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const fraction = total ? slice.value / total : 0;
      const arc = {
        ...slice,
        dash: `${fraction * circumference} ${circumference}`,
        rotation: (offset / (total || 1)) * 360,
      };
      offset += slice.value;
      return arc;
    });

  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={caption}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <motion.circle
            key={arc.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={arc.dash}
            strokeLinecap="butt"
            transform={`rotate(${arc.rotation - 90} ${size / 2} ${size / 2})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        ))}
      </svg>
      <div className="donut-centre">
        <span>{caption}</span>
        <b>{total.toLocaleString('uz-UZ')}</b>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function MonitoringDashboard({ onOpenAsset, onViewAsset }) {
  const { t } = useI18n();
  const reference = useReference();

  const [filters, setFilters] = useState({
    region: 'all',
    district: 'all',
    organization: 'all',
    classGroup: 'all',
    classSection: 'all',
    classItem: 'all',
  });
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [organizations, setOrganizations] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState('');

  const PER_PAGE = 8;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== 'all') params.set(key, value);
    }
    return params;
  }, [filters]);

  /* ---- the numbers and the map points ---- */
  useEffect(() => {
    let cancelled = false;
    api(`/admin/dashboard?${query.toString()}`, { auth: true })
      .then((data) => !cancelled && setStats(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query]);

  /* ---- the table under the numbers ---- */
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    api(`/admin/assets?${params.toString()}`, { auth: true })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [query, page]);

  useEffect(() => setPage(1), [filters]);

  /* ---- organisations narrow with the region ---- */
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.region !== 'all') params.set('region', filters.region);
    if (filters.district !== 'all') params.set('district', filters.district);
    api(`/admin/organizations?${params.toString()}`, { auth: true })
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, [filters.region, filters.district]);

  /* ---- cascading selects ---- */
  const regions = reference.regions || [];
  const districts = regions.find((r) => r.id === filters.region)?.districts || [];
  const groups = reference.classification || [];
  const sections = groups.find((g) => g.id === filters.classGroup)?.sections || [];
  const items = sections.find((s) => s.id === filters.classSection)?.items || [];

  const set = (key, value) =>
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (key === 'region') {
        next.district = 'all';
        next.organization = 'all';
      }
      if (key === 'district') next.organization = 'all';
      if (key === 'classGroup') {
        next.classSection = 'all';
        next.classItem = 'all';
      }
      if (key === 'classSection') next.classItem = 'all';
      return next;
    });

  const totals = stats?.totals || { total: 0, soz: 0, nosoz: 0, yaroqsiz: 0 };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const slices = [
    { id: 'soz', label: t('mon.dash.working'), value: totals.soz, color: TONE.soz },
    { id: 'nosoz', label: t('mon.dash.repair'), value: totals.nosoz, color: TONE.nosoz },
    { id: 'yaroqsiz', label: t('mon.dash.unusable'), value: totals.yaroqsiz, color: TONE.yaroqsiz },
  ];

  const pct = (value) => (totals.total ? Math.round((value / totals.total) * 100) : 0);
  const regionLabel =
    filters.region === 'all'
      ? t('mon.dash.allRegions')
      : regions.find((r) => r.id === filters.region)?.name || '';

  return (
    <div className="mon-dash">
      {error && <div className="form-alert bad">{error}</div>}

      {/* ---------------- filters ---------------- */}
      <div className="adm-panel mon-dash-filters">
        <select value={filters.region} onChange={(e) => set('region', e.target.value)} aria-label={t('mon.region')}>
          <option value="all">{t('mon.region')}</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={filters.district}
          onChange={(e) => set('district', e.target.value)}
          aria-label={t('mon.district')}
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
          value={filters.organization}
          onChange={(e) => set('organization', e.target.value)}
          aria-label={t('mon.org')}
        >
          <option value="all">{t('mon.org')}</option>
          {organizations.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name} ({o.count})
            </option>
          ))}
        </select>

        <select
          value={filters.classGroup}
          onChange={(e) => set('classGroup', e.target.value)}
          aria-label={t('mon.class1')}
        >
          <option value="all">{t('mon.class1')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={filters.classSection}
          onChange={(e) => set('classSection', e.target.value)}
          aria-label={t('mon.class2')}
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
          value={filters.classItem}
          onChange={(e) => set('classItem', e.target.value)}
          aria-label={t('mon.class3')}
          disabled={!items.length}
        >
          <option value="all">{t('mon.class3')}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      {/* ---------------- headline numbers ---------------- */}
      <div className="mon-cards">
        <StatCard
          tone="total"
          icon={Boxes}
          value={totals.total}
          title={t('mon.dash.title')}
          sub={t('mon.dash.sub')}
        />
        <StatCard
          tone="soz"
          icon={CheckCircle2}
          value={totals.soz}
          title={t('mon.dash.working')}
          sub={t('mon.dash.workingSub')}
        />
        <StatCard
          tone="nosoz"
          icon={Wrench}
          value={totals.nosoz}
          title={t('mon.dash.repair')}
          sub={t('mon.dash.repairSub')}
        />
        <StatCard
          tone="yaroqsiz"
          icon={Ban}
          value={totals.yaroqsiz}
          title={t('mon.dash.unusable')}
          sub={t('mon.dash.unusableSub')}
        />
      </div>

      {/* ---------------- table + chart ---------------- */}
      <div className="mon-dash-grid">
        <div className="adm-panel">
          <div className="adm-panel-head">
            <div className="mon-dash-region">
              <h2>
                {t('mon.region')}: {regionLabel}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowMap((v) => !v)}
              >
                {showMap ? <X size={13} /> : <MapIcon size={13} />}
                {showMap ? t('mon.dash.hideMap') : t('mon.dash.showMap')}
              </button>
            </div>
          </div>

          {showMap && (
            <div className="mon-dash-map">
              <AssetMap points={stats?.points || []} onPick={onViewAsset} />
            </div>
          )}

          <div className="adm-table-wrap mon-dash-table">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('mon.name')}</th>
                  <th>{t('mon.model')}</th>
                  <th>{t('mon.org')}</th>
                  <th>{t('mon.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="mono">{a.model}</td>
                    <td style={{ color: 'var(--accent)' }}>{a.organization}</td>
                    <td>
                      <button
                        type="button"
                        className="row-btn ok"
                        onClick={() => onViewAsset?.(a.id)}
                        aria-label={t('mon.row.view')}
                        title={t('mon.row.view')}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="adm-empty">{t('mon.empty')}</div>}
          </div>

          <div className="adm-pager">
            <div className="pager-btns">
              <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                ‹
              </button>
              <button type="button" className="active">
                {page}
              </button>
              <span style={{ alignSelf: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                / {pages}
              </span>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                ›
              </button>
            </div>
            <b style={{ fontSize: 13 }}>
              {t('mon.dash.totalAmount')}: {total.toLocaleString('uz-UZ')}
            </b>
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel-head">
            <div>
              <h2>{t('mon.dash.overall')}</h2>
            </div>
          </div>

          <div className="mon-chart">
            <Donut slices={slices} total={totals.total} caption={t('mon.dash.totalAmount')} />

            <ul className="mon-legend">
              {slices.map((s) => (
                <li key={s.id}>
                  <span className="dot" style={{ background: s.color }} />
                  <span className="lbl">{s.label}</span>
                  <b>{s.value.toLocaleString('uz-UZ')}</b>
                  <em>({pct(s.value)}%)</em>
                </li>
              ))}
              <li className="is-total">
                <span className="dot" style={{ background: 'var(--accent)' }} />
                <span className="lbl">{t('mon.dash.totalAmount')}</span>
                <b>{totals.total.toLocaleString('uz-UZ')}</b>
                <em>(100%)</em>
              </li>
            </ul>
          </div>

          {(stats?.byClass || []).length > 0 && (
            <div className="mon-byclass">
              <h3>{t('mon.filter.class')}</h3>
              {stats.byClass.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="mon-byclass-row"
                  onClick={() => set('classGroup', c.id)}
                >
                  <span className="nm">{c.name}</span>
                  <span className="track">
                    <span
                      className="fill"
                      style={{ width: `${totals.total ? (c.total / totals.total) * 100 : 0}%` }}
                    />
                  </span>
                  <b>{c.total}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ tone, icon: Icon, value, title, sub }) {
  return (
    <motion.div
      className={`mon-card is-${tone}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="mon-card-top">
        <span className="ic">
          <Icon size={18} />
        </span>
        <b>{value.toLocaleString('uz-UZ')}</b>
      </div>
      <h3>{title}</h3>
      <p>{sub}</p>
    </motion.div>
  );
}
