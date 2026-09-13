import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'motion/react';
import QRCode from 'react-qr-code';
import {
  Search,
  Plus,
  Menu,
  Moon,
  Sun,
  LogOut,
  Trash2,
  ShieldCheck,
  Check,
  Package,
  Layers,
  MessageSquare,
  ExternalLink,
  Users,
  Settings,
  Inbox,
  Pencil,
  BookOpenCheck,
  Printer,
  Globe,





} from 'lucide-react';

import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import ProductModal from '../components/admin/ProductModal.jsx';
import CategoryModal from '../components/admin/CategoryModal.jsx';
import ManualModal from '../components/admin/ManualModal.jsx';
import RequestModal from '../components/admin/RequestModal.jsx';
import ProductPreviewModal from '../components/admin/ProductPreviewModal.jsx';
import ContactEditor from '../components/admin/ContactEditor.jsx';
import NotificationBell from '../components/admin/NotificationBell.jsx';
import AssetModal from '../components/admin/AssetModal.jsx';
import MonitoringDashboard from '../components/admin/MonitoringDashboard.jsx';
import DeviceRegistry from '../components/admin/DeviceRegistry.jsx';
import IntegrationKeys from '../components/admin/IntegrationKeys.jsx';
import {
  AssetViewModal,
  AssetHistoryModal,
  AssetQrModal,
} from '../components/admin/AssetDialogs.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useI18n, LANGUAGES } from '../lib/i18n.jsx';
import { api, apiOptional } from '../lib/api.js';


const EASE = [0.16, 1, 0.3, 1];
const PER_PAGE = 8;

const initials = (name = '?') =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d`;
  return new Date(iso).toLocaleDateString('en-GB');
};

/* ------------------------------------------------------------------ */
/* pagination                                                         */
/* ------------------------------------------------------------------ */

function Pager({ page, pages, total, onChange, unit }) {
  if (pages <= 1) {
    return (
      <div className="adm-pager">
        <span>
          {total} {unit}
        </span>
      </div>
    );
  }
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  return (
    <div className="adm-pager">
      <span>
        {total} {unit}
      </span>
      <div className="pager-btns">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1}>
          ‹
        </button>
        {nums.map((n, i) => (
          <span key={n} style={{ display: 'contents' }}>
            {i > 0 && nums[i - 1] !== n - 1 && (
              <button type="button" disabled>
                …
              </button>
            )}
            <button type="button" className={n === page ? 'active' : ''} onClick={() => onChange(n)}>
              {n}
            </button>
          </span>
        ))}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page === pages}>
          ›
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* administrator modal                                                */
/* ------------------------------------------------------------------ */

const EMPTY_USER = {
  name: '',
  username: '',
  email: '',
  phone: '',
  organization: 'Gold Med Nova',
  role: 'admin',
  password: '',
};

function UserModal({ initial, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({ ...EMPTY_USER, ...(initial || {}), password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;
      const saved = editing
        ? await api(`/admin/users/${initial.id}`, { method: 'PATCH', body, auth: true })
        : await api('/admin/users', { method: 'POST', body, auth: true });
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
        <h3>{editing ? `${t('common.edit')} — ${initial.name}` : t('admin.addAdmin')}</h3>
        <p className="sub">{t('admin.team')}</p>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-name">{t('admin.name')}</label>
            <input
              id="m-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="m-username">{t('login.username')}</label>
            <input
              id="m-username"
              required
              disabled={editing}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="m-email">{t('contact.form.email')}</label>
            <input
              id="m-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="m-phone">{t('contact.form.phone')}</label>
            <input
              id="m-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="m-org">{t('admin.org')}</label>
            <input
              id="m-org"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="m-role">{t('admin.role')}</label>
            <select
              id="m-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="admin">{t('role.admin')}</option>
              <option value="manager">{t('role.manager')}</option>
              <option value="viewer">{t('role.viewer')}</option>
            </select>
          </div>
          <div className="field full">
            <label htmlFor="m-password">{t('login.password')}</label>
            <input
              id="m-password"
              type="password"
              required={!editing}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••"
            />
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

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

export default function Admin() {
  const { user, logout, isSuperAdmin, canEdit } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, tCat, tVal, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [view, setView] = useState('overview');
  const [sideOpen, setSideOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [manuals, setManuals] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [manualModal, setManualModal] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [assetModal, setAssetModal] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const [registryKey, setRegistryKey] = useState(0);

  const [globalQ, setGlobalQ] = useState('');
  const [prodFilters, setProdFilters] = useState({
    q: '',
    category: 'all',
    availability: 'all',
    mine: false,
  });
  const [userFilters, setUserFilters] = useState({ q: '', role: 'all', status: 'all' });
  const [inqFilter, setInqFilter] = useState('all');
  const [activeChild, setActiveChild] = useState(null);
  const [page, setPage] = useState(1);

  const { scrollY } = useScroll();
  const artY = useTransform(scrollY, [0, 400], reduce ? [0, 0] : [0, -46]);

  const load = useCallback(() => {
    Promise.all([
      api('/admin/stats', { auth: true }),
      // managers and viewers are not allowed the team list — they get []
      apiOptional('/admin/users', { auth: true }, []),
      api('/admin/products', { auth: true }),
      api('/admin/inquiries', { auth: true }),
      api('/admin/categories', { auth: true }),
      api('/admin/manuals', { auth: true }),
      api('/admin/assets?perPage=200', { auth: true }),
    ])
      .then(([s, u, p, i, c, m, a]) => {
        setStats(s);
        setUsers(u);
        setInventory(p);
        setInquiries(i);
        setCategoryList(c);
        setManuals(m);
        setAssets(a.items || []);
        setAssetTotal(a.grandTotal ?? (a.items || []).length);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);
  useEffect(() => setPage(1), [view, prodFilters, userFilters, inqFilter, globalQ]);

  /* ---------------- derived ---------------- */

  const categories = useMemo(() => {
    const counts = new Map((stats?.byCategory || []).map((b) => [b.id, b.inquiries]));
    return categoryList.map((c) => ({
      ...c,
      products: c.count,
      inquiries: counts.get(c.id) ?? 0,
    }));
  }, [categoryList, stats]);

  const manualByProduct = useMemo(() => {
    const map = new Map();
    for (const m of manuals) for (const pid of m.productIds || []) map.set(pid, m);
    return map;
  }, [manuals]);

  const filteredProducts = useMemo(() => {
    const q = (prodFilters.q || globalQ).toLowerCase();
    return inventory.filter((p) => {
      if (prodFilters.category !== 'all' && p.category !== prodFilters.category) return false;
      if (prodFilters.availability !== 'all' && p.availability !== prodFilters.availability) return false;
      if (prodFilters.mine && !p.custom) return false;
      if (q && !`${p.model} ${p.name} ${p.subcategory}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inventory, prodFilters, globalQ]);

  const filteredUsers = useMemo(() => {
    const q = (userFilters.q || globalQ).toLowerCase();
    return users.filter((u) => {
      if (userFilters.role !== 'all' && u.role !== userFilters.role) return false;
      if (userFilters.status !== 'all' && u.status !== userFilters.status) return false;
      if (q && !`${u.name} ${u.username} ${u.email} ${u.organization}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [users, userFilters, globalQ]);

  const filteredInquiries = useMemo(() => {
    const q = globalQ.toLowerCase();
    return inquiries.filter((i) => {
      if (inqFilter !== 'all' && i.status !== inqFilter) return false;
      if (q && !`${i.contactName} ${i.productModel} ${i.region}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inquiries, inqFilter, globalQ]);


  const assetTotals = useMemo(
    () => ({
      total: assets.length,
      soz: assets.filter((a) => a.status === 'soz').length,
      nosoz: assets.filter((a) => a.status === 'nosoz').length,
      yaroqsiz: assets.filter((a) => a.status === 'yaroqsiz').length,
    }),
    [assets],
  );

  const pageSlice = (list) => list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageCount = (list) => Math.max(1, Math.ceil(list.length / PER_PAGE));

  /* ---------------- actions ---------------- */

  const removeUser = async (target) => {
    if (!window.confirm(t('admin.confirmDelete', { name: target.name }))) return;
    try {
      await api(`/admin/users/${target.id}`, { method: 'DELETE', auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleStatus = async (target) => {
    const next = target.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api(`/admin/users/${target.id}`, { method: 'PATCH', body: { status: next }, auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setInquiryStatus = async (inq, status) => {
    try {
      const saved = await api(`/admin/inquiries/${inq.id}`, {
        method: 'PATCH',
        body: { status },
        auth: true,
      });
      setInquiries((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      setRequestModal((m) => (m && m.id === saved.id ? saved : m));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeProduct = async (target) => {
    if (!window.confirm(t('admin.confirmDelete', { name: target.model }))) return;
    try {
      await api(`/admin/products/${target.id}`, { method: 'DELETE', auth: true });
      setPreviewModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeCategory = async (target) => {
    if (!window.confirm(t('admin.confirmDelete', { name: target.name }))) return;
    try {
      await api(`/admin/categories/${target.id}`, { method: 'DELETE', auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeManual = async (target) => {
    if (!window.confirm(t('admin.confirmDelete', { name: target.title }))) return;
    try {
      await api(`/admin/manuals/${target.id}`, { method: 'DELETE', auth: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeAsset = async (target) => {
    if (!window.confirm(t('admin.confirmDelete', { name: `${target.model} — ${target.name}` }))) return;
    try {
      await api(`/admin/assets/${target.id}`, { method: 'DELETE', auth: true });
      setViewModal(null);
      bumpRegistry();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  /** the registry and the dashboard fetch their own pages — nudge them to refetch */
  const bumpRegistry = () => setRegistryKey((n) => n + 1);

  /* The dashboard and the notification feed hand back an id, the registry
     hands back the whole record — these accept either. */
  const fetchAsset = async (idOrAsset) => {
    if (idOrAsset && typeof idOrAsset === 'object') return idOrAsset;
    try {
      return await api(`/admin/assets/${idOrAsset}`, { auth: true });
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const openAssetById = async (idOrAsset) => {
    const asset = await fetchAsset(idOrAsset);
    if (asset) setAssetModal(asset);
  };

  const openViewById = async (idOrAsset) => {
    const asset = await fetchAsset(idOrAsset);
    if (asset) setViewModal(asset);
  };


  /* ---------------- sidebar plumbing ---------------- */

  const counts = {
    catalogues: categories.length,
    products: inventory.length,
    newRequests: inquiries.filter((i) => i.status === 'new').length,
    manuals: manuals.length,
    assets: assetTotal,
    faulty: assetTotals.nosoz + assetTotals.yaroqsiz,
    team: users.length,
  };

  const filterCategory = (id) => {
    setProdFilters((f) => ({ ...f, category: id, mine: false }));
    setActiveChild(id);
  };
  const filterProduct = (key) => {
    setProdFilters((f) => ({
      ...f,
      availability: key === 'In stock' || key === 'On order' ? key : 'all',
      mine: key === 'mine',
      category: key === 'all' ? 'all' : f.category,
    }));
    setActiveChild(key);
  };
  const filterRequest = (key) => {
    setInqFilter(key);
    setActiveChild(key);
  };

  const bannerCopy = {
    overview: t('admin.dashboard'),
    catalogues: t('admin.catalogues'),
    products: t('admin.products'),
    requests: t('admin.stat.requests'),
    monitoring: t('mon.sub'),
    devices: t('mon.registry'),
    integration: t('intg.sub'),
    manuals: t('manual.sub'),
    contact: t('contact.edit'),
    team: t('admin.team'),
    settings: t('admin.settings'),
  }[view];

  const maxWeek = Math.max(1, ...(stats?.week?.map((w) => w.value) || [1]));
  const maxCat = Math.max(1, ...categories.map((c) => c.products));

  return (
    <div className="adm-shell">
      <AdminSidebar
        view={view}
        onView={setView}
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        counts={counts}
        categories={categories}
        onFilterCategory={filterCategory}
        onFilterProduct={filterProduct}
        onFilterRequest={filterRequest}
        activeChild={activeChild}
      />

      <div className="adm-main">
        {/* ---------------- top bar ---------------- */}
        <div className="adm-top">
          <button
            type="button"
            className="icon-btn adm-burger"
            onClick={() => setSideOpen(true)}
            aria-label={t('nav.menu')}
          >
            <Menu size={16} />
          </button>

          <div className="adm-search">
            <Search size={15} color="var(--text-3)" />
            <input
              value={globalQ}
              onChange={(e) => setGlobalQ(e.target.value)}
              placeholder={t('admin.search')}
              aria-label={t('admin.search')}
            />
          </div>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t('nav.language')}
            style={{
              height: 40,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--adm-panel)',
              fontSize: 13,
              padding: '0 10px',
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.short}
              </option>
            ))}
          </select>

          <NotificationBell
            onOpenAsset={(assetId) => {
              const target = assets.find((a) => a.id === assetId);
              setView('monitoring');
              if (target) setAssetModal(target);
            }}
          />

          <button
            type="button"
            className="icon-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="adm-user">
            <span className="av">{initials(user?.name)}</span>
            <span>
              <span className="who">{user?.name}</span>
              <span className="role">{user?.role}</span>
            </span>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            aria-label={t('admin.signout')}
          >
            <LogOut size={16} />
          </button>
        </div>

        {error && (
          <div className="form-alert bad" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* the first sign-in used a password the server generated and printed
            to its log — it stays valid, but it should not stay in use */}
        {user?.mustChangePassword && (
          <div className="form-alert bad" style={{ marginBottom: 14 }}>
            <strong>Parolni almashtiring.</strong>{' '}
            Siz server yaratgan vaqtinchalik parol bilan kirdingiz. Sozlamalar
            bo‘limiga o‘tib, o‘zingizning parolingizni o‘rnating.
            {' '}
            <button
              type="button"
              onClick={() => setView('settings')}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                font: 'inherit',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Sozlamalarga o‘tish →
            </button>
          </div>
        )}

        {/* ---------------- banner ---------------- */}
        <div className="adm-banner">
          <h1>{t('admin.hello', { name: user?.name || '' })}</h1>
          <p>{bannerCopy}</p>
          <motion.div className="adm-banner-art" style={{ y: artY }} aria-hidden="true">
            <img src="/mri-scanner.png" alt="" />
          </motion.div>
        </div>

        {/* ---------------- stat cards ---------------- */}
        <div className="adm-stats">
          <div className="adm-stat">
            <span className="ico">
              <Package size={16} />
            </span>
            <b>{stats?.totals.products ?? '—'}</b>
            <span>{t('admin.stat.devices')}</span>
          </div>
          <div className="adm-stat">
            <span className="ico">
              <Layers size={16} />
            </span>
            <b>{stats?.totals.categories ?? '—'}</b>
            <span>{t('admin.stat.catalogues')}</span>
          </div>
          <div className="adm-stat">
            <span className="ico">
              <MessageSquare size={16} />
            </span>
            <b>{stats?.totals.inquiries ?? '—'}</b>
            <span>{t('admin.stat.requests')}</span>
          </div>
          {isSuperAdmin ? (
            <button type="button" className="adm-stat add" onClick={() => setModal({})}>
              <span className="ico">
                <Plus size={16} />
              </span>
              <em>{t('admin.addAdmin')}</em>
            </button>
          ) : (
            <div className="adm-stat">
              <span className="ico">
                <Users size={16} />
              </span>
              <b>{stats?.totals.admins ?? '—'}</b>
              <span>{t('admin.stat.admins')}</span>
            </div>
          )}
        </div>

        {/* ---------------- overview ---------------- */}
        {view === 'overview' && (
          <div className="adm-cols">
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h2>{t('admin.week')}</h2>
                    <p>{t('admin.weekSub')}</p>
                  </div>
                </div>
                <div className="chart-bars">
                  {(stats?.week || []).map((d) => (
                    <div className="bar-col" key={d.label}>
                      <motion.span
                        className="bar"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(4, (d.value / maxWeek) * 100)}%` }}
                        transition={{ duration: 0.7, ease: EASE }}
                        title={`${d.value}`}
                      />
                      <span className="lbl">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h2>{t('admin.perCat')}</h2>
                    <p>{t('admin.perCatSub')}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setView('products')}
                  >
                    {t('admin.products')}
                  </button>
                </div>
                <div className="cat-bars">
                  {categories.map((c) => (
                    <div className="cat-bar-row" key={c.id}>
                      <span className="nm">{tCat(c)}</span>
                      <span className="vl">
                        {c.products} · {c.inquiries}
                      </span>
                      <span className="cat-bar-track">
                        <motion.span
                          className="cat-bar-fill"
                          style={{ background: c.accent, display: 'block' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(c.products / maxCat) * 100}%` }}
                          transition={{ duration: 0.8, ease: EASE }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h2>{t('admin.latest')}</h2>
                    <p>{t('admin.latestSub')}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setView('requests')}
                  >
                    {t('admin.all')}
                  </button>
                </div>
                <div className="feed">
                  {(stats?.recentInquiries || []).map((i) => (
                    <button
                      type="button"
                      className="feed-item"
                      key={i.id}
                      onClick={() => setRequestModal(inquiries.find((x) => x.id === i.id) || i)}
                      style={{ textAlign: 'left', width: '100%' }}
                    >
                      <span className="dot">
                        <Inbox size={13} />
                      </span>
                      <div>
                        <p>
                          <b style={{ fontWeight: 500 }}>{i.contactName}</b> — {i.productModel || '—'}
                        </p>
                        <time>
                          {i.region || '—'} · {timeAgo(i.createdAt)}
                        </time>
                      </div>
                      <span className={`tag tag-${i.status}`} style={{ marginLeft: 'auto' }}>
                        {t(`status.${i.status}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel-head">
                  <div>
                    <h2>{t('admin.activity')}</h2>
                    <p>{t('admin.activitySub')}</p>
                  </div>
                </div>
                <div className="feed">
                  {(stats?.activity || []).map((a) => (
                    <div className="feed-item" key={a.id}>
                      <span className="dot">
                        <ShieldCheck size={13} />
                      </span>
                      <div>
                        <p>{a.text}</p>
                        <time>{timeAgo(a.at)}</time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- catalogues ---------------- */}
        {view === 'catalogues' && (
          <div className="adm-panel">
            <div className="adm-panel-head">
              <div>
                <h2>{t('admin.catalogues')}</h2>
                <p>
                  {categories.length} · {categories.filter((c) => c.custom).length}{' '}
                  {t('admin.custom')}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCategoryModal({})}
                >
                  <Plus size={14} /> {t('admin.newCatalogue')}
                </button>
              )}
            </div>

            <div className="cat-manage">
              {categories.map((c) => (
                <div className="cat-manage-card" key={c.id}>
                  <span className="swatch" style={{ background: c.accent }} />
                  <div className="cat-manage-main">
                    <div className="cat-manage-top">
                      <h3>{tCat(c)}</h3>
                      <span className={`tag ${c.custom ? 'tag-role-admin' : 'tag-role-viewer'}`}>
                        {c.custom ? t('admin.custom') : t('admin.imported')}
                      </span>
                    </div>
                    <p>{c.tagline || c.blurb || '—'}</p>
                    <div className="cat-manage-meta">
                      <span>
                        {c.products} {t('home.cats.devices')}
                      </span>
                      <span>·</span>
                      <span>{c.inquiries}</span>
                    </div>
                  </div>
                  <div className="cat-manage-actions">
                    <Link
                      className="row-btn"
                      to={`/market?category=${c.id}`}
                      target="_blank"
                      aria-label={`${t('common.open')} ${c.name}`}
                    >
                      <ExternalLink size={14} />
                    </Link>
                    {canEdit && (
                      <button
                        type="button"
                        className="row-btn"
                        onClick={() => setProductModal({ category: c.id })}
                        aria-label={`${t('admin.addDevice')} — ${c.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                    {canEdit && c.custom && (
                      <>
                        <button
                          type="button"
                          className="row-btn"
                          onClick={() => setCategoryModal(c)}
                          aria-label={`${t('common.edit')} ${c.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="row-btn danger"
                          onClick={() => removeCategory(c)}
                          aria-label={`${t('common.delete')} ${c.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- products ---------------- */}
        {view === 'products' && (
          <div className="adm-panel">
            <div className="adm-panel-head">
              <div>
                <h2>{t('admin.products')}</h2>
                <p>
                  {filteredProducts.length} / {inventory.length}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-ghost btn-sm" to="/market" target="_blank">
                  {t('admin.viewMarket')} <ExternalLink size={13} />
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setProductModal({})}
                    disabled={categories.length === 0}
                  >
                    <Plus size={14} /> {t('admin.addDevice')}
                  </button>
                )}
              </div>
            </div>

            <div className="adm-filters">
              <input
                value={prodFilters.q}
                onChange={(e) => setProdFilters({ ...prodFilters, q: e.target.value })}
                placeholder={t('market.search')}
                aria-label={t('market.search')}
              />
              <select
                value={prodFilters.category}
                onChange={(e) => setProdFilters({ ...prodFilters, category: e.target.value })}
                aria-label={t('admin.catalogues')}
              >
                <option value="all">{t('market.all')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
              <select
                value={prodFilters.availability}
                onChange={(e) => setProdFilters({ ...prodFilters, availability: e.target.value })}
                aria-label={t('product.availability')}
              >
                <option value="all">{t('product.availability')}</option>
                <option value="In stock">{t('market.inStock')}</option>
                <option value="On order">{t('market.onOrder')}</option>
              </select>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('admin.products')}</th>
                    <th>{t('product.catalogue')}</th>
                    <th>{t('admin.type')}</th>
                    <th>{t('product.availability')}</th>
                    <th>{t('product.leadTime')}</th>
                    <th>{t('admin.requests')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageSlice(filteredProducts).map((p) => (
                    <tr
                      key={p.id}
                      className="clickable"
                      onClick={() => setPreviewModal(p)}
                      title={t('admin.quickLook')}
                    >
                      <td>
                        <span className="cell-user">
                          <span className="thumb">
                            <img src={p.image} alt="" />
                          </span>
                          <span>
                            <b>{p.model}</b>
                            <span>{p.name}</span>
                          </span>
                        </span>
                      </td>
                      <td>{tCat(categories.find((c) => c.id === p.category)) || p.category}</td>
                      <td style={{ color: 'var(--text-2)' }}>{p.subcategory}</td>
                      <td>
                        <span
                          className={`tag ${
                            p.availability === 'In stock' ? 'tag-won' : 'tag-contacted'
                          }`}
                        >
                          {tVal(p.availability)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{tVal(p.leadTime)}</td>
                      <td>{p.inquiries}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          {manualByProduct.has(p.id) && (
                            <span className="row-btn" title={t('product.manual')}>
                              <BookOpenCheck size={14} />
                            </span>
                          )}
                          {p.custom && <span className="tag tag-role-admin">{t('admin.custom')}</span>}
                          <Link
                            className="row-btn"
                            to={`/product/${p.id}`}
                            target="_blank"
                            aria-label={`${t('common.open')} ${p.model}`}
                          >
                            <ExternalLink size={14} />
                          </Link>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                className="row-btn"
                                onClick={() => setProductModal(p)}
                                aria-label={`${t('common.edit')} ${p.model}`}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-btn danger"
                                onClick={() => removeProduct(p)}
                                aria-label={`${t('common.delete')} ${p.model}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="adm-empty">{t('market.empty.t')}</div>
              )}
            </div>

            <Pager
              page={page}
              pages={pageCount(filteredProducts)}
              total={filteredProducts.length}
              unit={t('home.cats.devices')}
              onChange={setPage}
            />
          </div>
        )}

        {/* ---------------- requests ---------------- */}
        {view === 'requests' && (
          <div className="adm-panel">
            <div className="adm-panel-head">
              <div>
                <h2>{t('admin.stat.requests')}</h2>
                <p>
                  {filteredInquiries.length} / {inquiries.length}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'new', 'contacted', 'quoted', 'won', 'lost'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`cat-pill${inqFilter === s ? ' active' : ''}`}
                    onClick={() => filterRequest(s)}
                  >
                    {t(`status.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('admin.customer')}</th>
                    <th>{t('admin.device')}</th>
                    <th>{t('contact.form.region')}</th>
                    <th>{t('contact.form.phone')}</th>
                    <th>{t('contact.form.qty')}</th>
                    <th>{t('admin.received')}</th>
                    <th>{t('admin.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageSlice(filteredInquiries).map((i) => (
                    <tr
                      key={i.id}
                      className="clickable"
                      onClick={() => setRequestModal(i)}
                      title={t('contact.form.message')}
                    >
                      <td>
                        <span className="cell-user">
                          <span className="av">{initials(i.contactName)}</span>
                          <span>
                            <b>{i.contactName}</b>
                            <span>{i.email || '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td>{i.productModel || '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{i.region || '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{i.phone}</td>
                      <td>{i.quantity}</td>
                      <td style={{ color: 'var(--text-2)' }}>{timeAgo(i.createdAt)}</td>
                      <td>
                        <span className={`tag tag-${i.status}`}>{t(`status.${i.status}`)}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-btn"
                            onClick={() => setRequestModal(i)}
                            aria-label={t('contact.form.message')}
                          >
                            <MessageSquare size={14} />
                          </button>
                          <select
                            value={i.status}
                            onChange={(e) => setInquiryStatus(i, e.target.value)}
                            aria-label={`status ${i.contactName}`}
                            style={{
                              height: 28,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--adm-panel)',
                              fontSize: 12,
                              padding: '0 6px',
                            }}
                          >
                            {['new', 'contacted', 'quoted', 'won', 'lost'].map((s) => (
                              <option key={s} value={s}>
                                {t(`status.${s}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInquiries.length === 0 && (
                <div className="adm-empty">{t('market.empty.t')}</div>
              )}
            </div>

            <Pager
              page={page}
              pages={pageCount(filteredInquiries)}
              total={filteredInquiries.length}
              unit={t('admin.requests').toLowerCase()}
              onChange={setPage}
            />
          </div>
        )}

        {/* ---------------- apparat monitoringi: dashboard ---------------- */}
        {view === "monitoring" && (
          <MonitoringDashboard onOpenAsset={openAssetById} onViewAsset={openViewById} />
        )}

        {/* ---------------- qurilmalar ro‘yxati ---------------- */}
        {view === "devices" && (
          <DeviceRegistry
            canEdit={canEdit}
            isAdmin={canEdit}
            refreshKey={registryKey}
            onCreate={() => setAssetModal({})}
            onEdit={(a) => setAssetModal(a)}
            onView={(a) => setViewModal(a)}
            onHistory={(a) => setHistoryModal(a)}
            onQr={(a) => setQrModal(a)}
            onDelete={removeAsset}
          />
        )}

        {/* ---------------- integratsiya ---------------- */}
        {view === "integration" && <IntegrationKeys isSuperAdmin={isSuperAdmin} />}

        {/* ---------------- manuals ---------------- */}
        {view === 'manuals' && (
          <div className="adm-panel">
            <div className="adm-panel-head">
              <div>
                <h2>{t('admin.manuals')}</h2>
                <p>{t('manual.attachHint')}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setManualModal({})}
                >
                  <Plus size={14} /> {t('manual.new')}
                </button>
              )}
            </div>

            <div className="mn-list">
              {manuals.map((m) => (
                <div className="mn-card" key={m.id}>
                  <span className="qr">
                    <QRCode
                      value={`${window.location.origin}/manual/${m.id}`}
                      size={62}
                      bgColor="#FFFFFF"
                      fgColor="#101828"
                      level="L"
                    />
                  </span>
                  <div className="mn-card-main">
                    <h3>{m.title}</h3>
                    <div className="who">
                      {m.deviceModel || '—'} · {m.contactName || '—'} · {m.contactPhone || '—'}
                    </div>
                    <div className="att">
                      {(m.devices || []).slice(0, 4).map((d) => (
                        <span key={d.id}>{d.model}</span>
                      ))}
                      {(m.devices || []).length > 4 && <span>+{m.devices.length - 4}</span>}
                      {(m.devices || []).length === 0 && <span>{t('common.none')}</span>}
                    </div>
                  </div>
                  <div className="mn-card-actions">
                    <a
                      className="row-btn"
                      href={`/manual/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('common.open')}
                    >
                      <ExternalLink size={14} />
                    </a>
                    <a
                      className="row-btn"
                      href={`/manual/${m.id}?print=1`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('manual.print')}
                    >
                      <Printer size={14} />
                    </a>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="row-btn"
                          onClick={() => setManualModal(m)}
                          aria-label={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="row-btn danger"
                          onClick={() => removeManual(m)}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {manuals.length === 0 && <div className="adm-empty">{t('manual.sub')}</div>}
          </div>
        )}

        {/* ---------------- contact page ---------------- */}
        {view === 'contact' && <ContactEditor canEdit={canEdit} onSaved={() => load()} />}

        {/* ---------------- team ---------------- */}
        {view === 'team' && (
          <div className="adm-panel">
            <div className="adm-panel-head">
              <div>
                <h2>{t('admin.team')}</h2>
                <p>
                  {filteredUsers.length} / {users.length}
                </p>
              </div>
              {isSuperAdmin && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({})}>
                  <Plus size={14} /> {t('admin.addAdmin')}
                </button>
              )}
            </div>

            <div className="adm-filters">
              <input
                value={userFilters.q}
                onChange={(e) => setUserFilters({ ...userFilters, q: e.target.value })}
                placeholder={t('admin.name')}
                aria-label={t('admin.name')}
              />
              <select
                value={userFilters.role}
                onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}
                aria-label="role"
              >
                <option value="all">{t('market.all')}</option>
                <option value="superadmin">{t('role.superadmin')}</option>
                <option value="admin">{t('role.admin')}</option>
                <option value="manager">{t('role.manager')}</option>
                <option value="viewer">{t('role.viewer')}</option>
              </select>
              <select
                value={userFilters.status}
                onChange={(e) => setUserFilters({ ...userFilters, status: e.target.value })}
                aria-label="status"
              >
                <option value="all">{t('market.all')}</option>
                <option value="active">{t('ustatus.active')}</option>
                <option value="invited">{t('ustatus.invited')}</option>
                <option value="suspended">{t('ustatus.suspended')}</option>
              </select>
            </div>

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('admin.name')}</th>
                    <th>{t('contact.form.email')}</th>
                    <th>{t('admin.org')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.tfa')}</th>
                    <th>{t('admin.lastActive')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageSlice(filteredUsers).map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="cell-user">
                          <span className="av">{initials(u.name)}</span>
                          <span>
                            <b>{u.name}</b>
                            <span>@{u.username}</span>
                          </span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{u.email}</td>
                      <td style={{ color: 'var(--text-2)' }}>{u.organization}</td>
                      <td>
                        <span className={`tag tag-role-${u.role}`}>{t(`role.${u.role}`)}</span>
                      </td>
                      <td>
                        {u.twoFactor ? (
                          <Check size={15} color="var(--ok)" />
                        ) : (
                          <span style={{ color: 'var(--warn)', fontWeight: 600 }}>!</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{timeAgo(u.lastActive)}</td>
                      <td>
                        <div className="row-actions">
                          <span className={`tag tag-status-${u.status}`}>{t(`ustatus.${u.status}`)}</span>
                          {isSuperAdmin && u.role !== 'superadmin' && (
                            <>
                              <button
                                type="button"
                                className="row-btn"
                                onClick={() => setModal(u)}
                                aria-label={`${t('common.edit')} ${u.name}`}
                              >
                                <Settings size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-btn"
                                onClick={() => toggleStatus(u)}
                                aria-label="status"
                              >
                                <ShieldCheck size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-btn danger"
                                onClick={() => removeUser(u)}
                                aria-label={`${t('common.delete')} ${u.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div className="adm-empty">{t('market.empty.t')}</div>}
            </div>

            <Pager
              page={page}
              pages={pageCount(filteredUsers)}
              total={filteredUsers.length}
              unit={t('admin.team').toLowerCase()}
              onChange={setPage}
            />
          </div>
        )}

        {/* ---------------- settings ---------------- */}
        {view === 'settings' && <SettingsView user={user} />}
      </div>

      {/* ---------------- modals ---------------- */}
      <AnimatePresence>
        {modal && (
          <UserModal
            initial={modal.id ? modal : null}
            onClose={() => setModal(null)}
            onSaved={() => load()}
          />
        )}
        {productModal && (
          <ProductModal
            initial={productModal}
            categories={categories}
            manuals={manuals}
            onClose={() => setProductModal(null)}
            onSaved={() => load()}
          />
        )}
        {categoryModal && (
          <CategoryModal
            initial={categoryModal.id ? categoryModal : null}
            onClose={() => setCategoryModal(null)}
            onSaved={() => load()}
          />
        )}
        {manualModal && (
          <ManualModal
            initial={manualModal.id ? manualModal : null}
            products={inventory}
            onClose={() => setManualModal(null)}
            onSaved={() => load()}
          />
        )}
        {requestModal && (
          <RequestModal
            inquiry={requestModal}
            onClose={() => setRequestModal(null)}
            onStatus={setInquiryStatus}
          />
        )}
        {assetModal && (
          <AssetModal
            initial={assetModal.id ? assetModal : null}
            products={inventory}
            manuals={manuals}
            onClose={() => setAssetModal(null)}
            onSaved={() => {
              bumpRegistry();
              load();
            }}
          />
        )}
        {viewModal && (
          <AssetViewModal
            asset={viewModal}
            canEdit={canEdit}
            onClose={() => setViewModal(null)}
            onEdit={(a) => {
              setViewModal(null);
              setAssetModal(a);
            }}
            onHistory={(a) => {
              setViewModal(null);
              setHistoryModal(a);
            }}
          />
        )}
        {historyModal && (
          <AssetHistoryModal asset={historyModal} onClose={() => setHistoryModal(null)} />
        )}
        {qrModal && <AssetQrModal asset={qrModal} onClose={() => setQrModal(null)} />}
        {previewModal && (
          <ProductPreviewModal
            product={previewModal}
            categoryName={
              tCat(categories.find((c) => c.id === previewModal.category)) || previewModal.category
            }
            manual={manualByProduct.get(previewModal.id)}
            canEdit={canEdit}
            onClose={() => setPreviewModal(null)}
            onEdit={(p) => {
              setPreviewModal(null);
              setProductModal(p);
            }}
            onDelete={removeProduct}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* settings                                                           */
/* ------------------------------------------------------------------ */

function SettingsView({ user }) {
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api('/auth/password', { method: 'POST', body: form, auth: true });
      setMsg({ ok: true, text: `${t('common.save')} ✓` });
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-cols">
      <div className="adm-panel">
        <div className="adm-panel-head">
          <div>
            <h2>{t('login.password')}</h2>
            <p>
              {user?.name} ({user?.role})
            </p>
          </div>
        </div>
        <form onSubmit={submit} style={{ padding: '0 18px 20px' }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cur">{t('login.password')}</label>
              <input
                id="cur"
                type="password"
                required
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="new">{t('login.password')} *</label>
              <input
                id="new"
                type="password"
                required
                minLength={6}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              />
            </div>
            <div className="field full">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
          {msg && <div className={`form-alert ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
        </form>
      </div>

      <div className="adm-panel">
        <div className="adm-panel-head">
          <div>
            <h2>{t('admin.settings')}</h2>
            <p>{t('nav.language')}</p>
          </div>
        </div>
        <div style={{ padding: '0 18px 20px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`cat-pill${lang === l.code ? ' active' : ''}`}
                onClick={() => setLang(l.code)}
              >
                <Globe size={13} /> {l.label}
              </button>
            ))}
          </div>

          <div className="spec-table" style={{ marginTop: 0 }}>
            <div>
              <span>{t('contact.form.name')}</span>
              <b>{user?.name}</b>
            </div>
            <div>
              <span>{t('login.username')}</span>
              <b>@{user?.username}</b>
            </div>
            <div>
              <span>{t('contact.form.email')}</span>
              <b>{user?.email}</b>
            </div>
            <div>
              <span>{t('contact.form.phone')}</span>
              <b>{user?.phone || '—'}</b>
            </div>
            <div>
              <span>{t('admin.role')}</span>
              <b>{t(`role.${user?.role}`)}</b>
            </div>
            <div>
              <span>{t('admin.tfa')}</span>
              <b>{user?.twoFactor ? t('common.yes') : t('common.no')}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
