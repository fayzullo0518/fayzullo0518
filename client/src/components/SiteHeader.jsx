import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  ChevronDown,
  Moon,
  Sun,
  Globe,
  Check,  ArrowRight,
  Boxes,
} from 'lucide-react';

import Logo from './Logo.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useI18n, LANGUAGES } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';

const EASE = [0.16, 1, 0.3, 1];

/* ------------------------------------------------------------------ */
/* language menu                                                       */
/* ------------------------------------------------------------------ */

function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
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

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="gh-lang" ref={ref}>
      <button
        type="button"
        className="gh-pill"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.language')}
      >
        <Globe size={16} />
        <span className="lbl">{current.short}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="gh-lang-menu"
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="menuitem"
                className={l.code === lang ? 'active' : ''}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
              >
                <span className="flag">{l.flag}</span>
                {l.label}
                {l.code === lang && <Check size={14} className="tick" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* header                                                              */
/* ------------------------------------------------------------------ */

export default function SiteHeader({ overHero = false }) {
  const { t, tCat, tCatTag } = useI18n();
  const { theme, toggle } = useTheme();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const dropRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setDropOpen(false);
    setSheetOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!dropOpen) return undefined;
    const onDown = (e) => !dropRef.current?.contains(e.target) && setDropOpen(false);
    const onKey = (e) => e.key === 'Escape' && setDropOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [dropOpen]);

  const solid = scrolled || !overHero;
  const showCta = scrolled || !overHero;

  return (
    <>
      <header className={`gh${solid ? ' is-solid' : ' is-over'}`}>
        <div className="gh-inner">
          <Logo size={22} className="gh-brand" />

          <nav className="gh-nav" aria-label={t('a11y.main')}>
            <NavLink to="/" end className={({ isActive }) => `gh-link${isActive ? ' active' : ''}`}>
              {t('nav.home')}
            </NavLink>

            <div style={{ position: 'relative' }} ref={dropRef}>
              <button
                type="button"
                className={`gh-link${location.pathname === '/market' ? ' active' : ''}`}
                onClick={() => setDropOpen((v) => !v)}
                aria-expanded={dropOpen}
                aria-haspopup="true"
              >
                {t('nav.catalogues')}
                <ChevronDown size={14} className="chev" />
              </button>

              <AnimatePresence>
                {dropOpen && (
                  <motion.div
                    className="gh-drop"
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.26, ease: EASE }}
                  >
                    <div className="gh-drop-grid">
                      {categories.slice(0, 8).map((c) => (
                        <Link
                          key={c.id}
                          className="gh-drop-item"
                          to={`/market?category=${c.id}`}
                          onClick={() => setDropOpen(false)}
                        >
                          <span className="ic" style={{ background: c.accent }}>
                            <Boxes size={17} />
                          </span>
                          <span>
                            <h4>
                              {tCat(c)}
                              {c.custom && <span className="gh-badge">new</span>}
                            </h4>
                            <p>{tCatTag(c) || `${c.count} ${t('home.cats.devices')}`}</p>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <div className="gh-drop-foot">
                      <span>
                        {categories.length} {t('nav.catalogues').toLowerCase()} ·{' '}
                        {categories.reduce((s, c) => s + c.count, 0)} {t('home.cats.devices')}
                      </span>
                      <Link className="btn btn-ghost btn-sm" to="/market">
                        {t('market.all')} <ArrowRight size={13} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <NavLink to="/market" className={({ isActive }) => `gh-link${isActive ? ' active' : ''}`}>
              {t('nav.market')}
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `gh-link${isActive ? ' active' : ''}`}>
              {t('nav.contact')}
            </NavLink>
          </nav>

          <div className="gh-right">
            <LanguageMenu />

            <button
              type="button"
              className="gh-pill icon-only"
              onClick={toggle}
              aria-label={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <AnimatePresence>
              {showCta && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  style={{ overflow: 'hidden' }}
                >
                  <Link className="gh-cta" to="/contact">
                    {t('nav.orderCta')}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              className="gh-pill"
              onClick={() => setSheetOpen(true)}
              aria-label={t('nav.menu')}
            >
              <Menu size={16} />
              <span className="lbl">{t('nav.menu')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- mobile / full menu sheet ---------------- */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            className="gh-sheet"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="gh-sheet-top">
              <Logo size={22} />
              <button
                type="button"
                className="gh-pill icon-only"
                onClick={() => setSheetOpen(false)}
                aria-label={t('nav.close')}
              >
                <X size={16} />
              </button>
            </div>

            <nav>
              <Link to="/">{t('nav.home')}</Link>
              <Link to="/market">{t('nav.market')}</Link>
              <Link to="/contact">{t('nav.contact')}</Link>
            </nav>

            <div className="gh-sheet-cats">
              <h5>{t('nav.catalogues')}</h5>
              <div className="grid">
                {categories.map((c) => (
                  <Link key={c.id} to={`/market?category=${c.id}`}>
                    {tCat(c)} · {c.count}
                  </Link>
                ))}
              </div>
            </div>

            <div className="gh-sheet-foot">
              <div className="row">
                <LanguageMenu />
                <button type="button" className="gh-pill" onClick={toggle}>
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  <span className="lbl">
                    {theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
                  </span>
                </button>
              </div>
              <Link className="gh-cta" to="/contact" style={{ justifyContent: 'center' }}>
                {t('nav.orderCta')} <ArrowRight size={15} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
