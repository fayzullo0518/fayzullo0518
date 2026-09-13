import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LogIn,
  User,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  ArrowLeft,
  Send,
  Instagram,
  Mail,
  Globe,
} from 'lucide-react';

import Logo from '../components/Logo.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useContacts } from '../lib/contact.js';
import { useI18n, LANGUAGES } from '../lib/i18n.jsx';
import { ADMIN_PATH } from '../lib/routes.js';

const EASE = [0.16, 1, 0.3, 1];
const CHANNEL_ICONS = { instagram: Instagram, telegram: Send, email: Mail };
const CHANNEL_COLOURS = { instagram: '#E1306C', telegram: '#229ED9', email: 'var(--text-2)' };

export default function Login() {
  const { theme, toggle } = useTheme();
  const { login, user, ready } = useAuth();
  const { t, lang, setLang } = useI18n();
  const contacts = useContacts();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const target = location.state?.from || location.pathname || ADMIN_PATH;

  useEffect(() => {
    if (ready && user) navigate(target, { replace: true });
  }, [ready, user, navigate, target]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-sky" aria-hidden="true">
        <span className="cloud cloud-a" />
        <span className="cloud cloud-b" />
        <span className="cloud cloud-c" />
        <span className="cloud cloud-d" />
        <span className="login-arc" />
      </div>

      <div className="login-top">
        <Logo size={22} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t('nav.language')}
            style={{
              height: 36,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
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
          <Link to="/" className="icon-btn" aria-label={t('login.back')}>
            <ArrowLeft size={16} />
          </Link>
          <button
            type="button"
            className="icon-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      <div className="login-body">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <span className="login-badge">
            <LogIn size={20} />
          </span>

          <h1>{t('login.title')}</h1>
          <p className="login-lede">{t('login.lede')}</p>

          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username" className="sr-only">
              {t('login.username')}
            </label>
            <div className="login-input">
              <User size={15} color="var(--text-3)" />
              <input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login.username')}
              />
            </div>

            <label htmlFor="password" className="sr-only">
              {t('login.password')}
            </label>
            <div className="login-input">
              <Lock size={15} color="var(--text-3)" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.password')}
              />
              <button
                type="button"
                className="eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('common.close') : t('common.open')}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {contacts.channels[1] && (
              <a
                className="login-forgot"
                href={contacts.channels[1].url}
                target="_blank"
                rel="noreferrer"
              >
                {t('login.forgot')}
              </a>
            )}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          {error && <div className="login-error">{error}</div>}

          <div className="login-divider">{t('login.or')}</div>

          <div className="login-socials">
            {contacts.channels.map((c) => {
              const Icon = CHANNEL_ICONS[c.id] || Globe;
              return (
                <a
                  key={c.id}
                  className="login-social"
                  href={c.url}
                  target={c.url.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  aria-label={`${c.label} ${c.handle}`}
                >
                  <Icon size={17} color={CHANNEL_COLOURS[c.id] || 'var(--text-2)'} />
                </a>
              );
            })}
          </div>

        </motion.div>
      </div>

      <div className="login-foot">
        © {new Date().getFullYear()} {contacts.legal || 'Gold Med Nova'}
      </div>
    </div>
  );
}
