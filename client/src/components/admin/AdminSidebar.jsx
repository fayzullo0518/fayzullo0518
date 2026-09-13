import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Library,
  Boxes,
  Inbox,
  BookOpenCheck,
  Activity,
  ClipboardList,
  Plug,
  Users,
  Settings,
  Phone,
  ExternalLink,
  Plus,
  Minus,
  X,
  UserRound,
  KeyRound,
  Bell,
  LogOut,
  Home,
} from 'lucide-react';

import { LogoMark } from '../Logo.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useAuth } from '../../lib/auth.jsx';

const EASE = [0.16, 1, 0.3, 1];

const initials = (name = '?') =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/**
 * Two-part sidebar: a slim icon rail, and a panel whose sections expand into
 * nested filters. Selecting a nested item both switches the view and applies
 * the matching filter, so the tree mirrors what the table shows.
 */
export default function AdminSidebar({
  view,
  onView,
  open,
  onClose,
  counts,
  categories,
  onFilterCategory,
  onFilterProduct,
  onFilterRequest,
  activeChild,
}) {
  const { t, tCat } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // nothing is expanded until it is asked for
  const [expanded, setExpanded] = useState(() => new Set());
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [pinned, setPinned] = useState(false);
  const profileRef = useRef(null);
  const asideRef = useRef(null);

  /**
   * On a wide screen the panel opens on hover and folds away again when the
   * cursor leaves it — unless it has been clicked. A click pins it open, and
   * from then on only the “X” or a click somewhere else closes it, so nobody
   * loses the panel mid-task just by moving the mouse.
   */
  useEffect(() => {
    const wide = () => window.matchMedia('(min-width: 1100px)').matches;

    const onPointerDown = (event) => {
      if (!wide()) return;
      // the profile popup is rendered outside the aside but belongs to it
      if (asideRef.current?.contains(event.target) || event.target.closest?.('.sb-profile')) {
        setPinned(true);
        setCollapsed(false);
        return;
      }
      setPinned(false);
      setCollapsed(true);
    };

    const onMouseMove = (event) => {
      if (!wide()) return;
      if (event.clientX <= 18) setCollapsed(false);
    };

    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setCollapsed(true);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDown = (e) => !profileRef.current?.contains(e.target) && setProfileOpen(false);
    const onKey = (e) => e.key === 'Escape' && setProfileOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const toggleGroup = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const GROUPS = [
    { id: 'overview', label: t('admin.dashboard'), icon: LayoutDashboard },
    {
      id: 'catalogues',
      label: t('admin.catalogues'),
      icon: Library,
      count: counts.catalogues,
      children: categories.map((c) => ({
        key: c.id,
        label: tCat(c),
        n: c.count,
        onPick: () => onFilterCategory(c.id),
      })),
    },
    {
      id: 'products',
      label: t('admin.products'),
      icon: Boxes,
      count: counts.products,
      children: [
        { key: 'all', label: t('market.all'), onPick: () => onFilterProduct('all') },
        { key: 'In stock', label: t('market.inStock'), onPick: () => onFilterProduct('In stock') },
        { key: 'On order', label: t('market.onOrder'), onPick: () => onFilterProduct('On order') },
        { key: 'mine', label: t('admin.custom'), onPick: () => onFilterProduct('mine') },
      ],
    },
    {
      id: 'requests',
      label: t('admin.requests'),
      icon: Inbox,
      count: counts.newRequests,
      alert: counts.newRequests > 0,
      children: ['all', 'new', 'contacted', 'quoted', 'won', 'lost'].map((s) => ({
        key: s,
        label: t(`status.${s}`),
        onPick: () => onFilterRequest(s),
      })),
    },
    {
      id: 'monitoring',
      label: t('mon.title'),
      icon: Activity,
      count: counts.assets,
      alert: counts.faulty > 0,
    },
    { id: 'devices', label: t('mon.registry'), icon: ClipboardList, count: counts.assets },
    { id: 'integration', label: t('intg.title'), icon: Plug },
    { id: 'manuals', label: t('admin.manuals'), icon: BookOpenCheck, count: counts.manuals },
    { id: 'contact', label: t('admin.contactPage'), icon: Phone },
    { id: 'team', label: t('admin.team'), icon: Users, count: counts.team },
    { id: 'settings', label: t('admin.settings'), icon: Settings },
  ];

  const pick = (id) => {
    onView(id);
    onClose?.();
  };

  return (
    <>
      {open && <div className="sb-backdrop" onClick={onClose} role="presentation" />}

      <aside
        ref={asideRef}
        className={`sb${open ? ' open' : ''}${collapsed ? ' is-collapsed' : ''}${
          pinned ? ' is-pinned' : ''
        }`}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => {
          // a pinned panel stays put; only “X” or a click elsewhere closes it
          if (!pinned) setCollapsed(true);
        }}
      >
        {/* ---------------- icon rail ---------------- */}
        <div className="sb-rail">
          <Link to="/" className="sb-rail-logo" aria-label={t('nav.backToSite')}>
            <LogoMark size={20} />
          </Link>

          {GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                type="button"
                className={`sb-ico${view === g.id ? ' active' : ''}`}
                onClick={() => pick(g.id)}
                title={g.label}
                aria-label={g.label}
              >
                <Icon size={17} />
                {g.alert && <span className="dotmark" />}
              </button>
            );
          })}

          <span className="sb-rail-spacer" />

          <div className="sb-rail-bottom">
            <Link to="/" className="sb-ico" title={t('nav.backToSite')} aria-label={t('nav.backToSite')}>
              <Home size={17} />
            </Link>
            <button
              type="button"
              className="sb-avatar"
              onClick={() => setProfileOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label={user?.name}
            >
              {initials(user?.name)}
            </button>
          </div>
        </div>

        {/* ---------------- panel ---------------- */}
        <div className="sb-panel">
          <div className="sb-panel-head">
            <h2>Gold Med Nova</h2>
            <button
              type="button"
              className="gh-pill icon-only"
              style={{ width: 30, height: 30, background: 'transparent' }}
              onClick={() => {
                setPinned(false);
                setCollapsed(true);
                onClose?.();
              }}
              aria-label={t('nav.close')}
            >
              <X size={15} />
            </button>
          </div>

          <div className="sb-tabs">
            <button type="button" className="sb-tab active">
              {t('admin.dashboard')}
            </button>
            <Link className="sb-tab" to="/market" target="_blank">
              {t('nav.market')} <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
            </Link>
          </div>

          <div className="sb-groups">
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const isOpen = expanded.has(g.id);
              return (
                <div key={g.id}>
                  <div className={`sb-group-row${view === g.id ? ' active' : ''}`}>
                    <Icon size={16} />
                    <button
                      type="button"
                      className="label"
                      onClick={() => pick(g.id)}
                      style={{ background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                    >
                      {g.label}
                    </button>
                    {g.count !== undefined && <span className="cnt">{g.count}</span>}
                    {g.children && (
                      <button
                        type="button"
                        className="exp"
                        onClick={() => toggleGroup(g.id)}
                        aria-label={`${g.label} — ${isOpen ? '−' : '+'}`}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <Minus size={13} /> : <Plus size={13} />}
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {g.children && isOpen && (
                      <motion.div
                        className="sb-children"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                      >
                        {g.children.map((child) => (
                          <button
                            key={child.key}
                            type="button"
                            className={`sb-child${
                              view === g.id && activeChild === child.key ? ' active' : ''
                            }`}
                            onClick={() => {
                              child.onPick();
                              pick(g.id);
                            }}
                          >
                            <span className="bullet" />
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {child.label}
                            </span>
                            {child.n !== undefined && <span className="n">{child.n}</span>}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="sb-panel-foot">
            <div className="sb-note">
              <h5>{t('admin.newRequests')}</h5>
              <p>{t('admin.newRequestsBody', { n: counts.newRequests })}</p>
              <button
                type="button"
                onClick={() => {
                  onFilterRequest('new');
                  pick('requests');
                }}
              >
                {t('admin.review')}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- profile popup ---------------- */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            className="sb-profile"
            ref={profileRef}
            role="menu"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <div className="sb-profile-head">
              <span className="av">{initials(user?.name)}</span>
              <span style={{ minWidth: 0 }}>
                <b>{user?.name}</b>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              </span>
            </div>

            <button
              type="button"
              className="sb-profile-item"
              onClick={() => {
                setProfileOpen(false);
                pick('settings');
              }}
            >
              <UserRound size={15} /> {t('admin.settings')}
              <kbd>⌘K→P</kbd>
            </button>
            <button
              type="button"
              className="sb-profile-item"
              onClick={() => {
                setProfileOpen(false);
                pick('settings');
              }}
            >
              <KeyRound size={15} /> {t('login.password')}
              <kbd>⌘S</kbd>
            </button>
            <button
              type="button"
              className="sb-profile-item"
              onClick={() => {
                setProfileOpen(false);
                pick('requests');
              }}
            >
              <Bell size={15} /> {t('admin.newRequests')}
              <kbd>{counts.newRequests}</kbd>
            </button>

            <span className="sb-profile-sep" />

            <button
              type="button"
              className="sb-profile-item"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={15} /> {t('admin.signout')}
              <kbd>⌥⇧Q</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
