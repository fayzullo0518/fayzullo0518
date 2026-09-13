import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';

import SiteHeader from './components/SiteHeader.jsx';
import Home from './pages/Home.jsx';
import Market from './pages/Market.jsx';
import Product from './pages/Product.jsx';
import Contact from './pages/Contact.jsx';
import Manual from './pages/Manual.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import QrLanding from './pages/QrLanding.jsx';
import { useAuth } from './lib/auth.jsx';
import { useI18n } from './lib/i18n.jsx';
import { ADMIN_PATHS, isAdminPath } from './lib/routes.js';


function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function AdminGate() {
  const { user, ready } = useAuth();
  const { t } = useI18n();

  if (!ready) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        {t('market.loading')}
      </div>
    );
  }
  return user ? <Admin /> : <Login />;
}

export default function App() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  // the dashboard, the sign-in card and the QR page bring their own chrome
  const bare = isAdminPath(pathname) || pathname.startsWith('/q/');
  // on the home page the bar floats over the hero until the visitor scrolls
  const overHero = pathname === '/';

  return (
    <div className="nm-shell">
      <a className="skip-link" href="#main">
        {t('nav.home')}
      </a>
      <ScrollToTop />
      {!bare && <SiteHeader overHero={overHero} />}
      <main className="nm-main" id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/market" element={<Market />} />
          <Route path="/product/:productId" element={<Product />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/contact/:productId" element={<Contact />} />
          <Route path="/manual/:manualId" element={<Manual />} />

          {/* the printed QR label lands here */}
          <Route path="/q/:assetId" element={<QrLanding />} />

          {/* the only ways into the panel — neither is linked anywhere */}
          {ADMIN_PATHS.map((path) => (
            <Route key={path} path={path} element={<AdminGate />} />
          ))}

          {/* the old, guessable addresses lead nowhere */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
