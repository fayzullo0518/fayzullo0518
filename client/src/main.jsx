import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { I18nProvider } from './lib/i18n.jsx';

import './styles/global.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/site.css';
import './styles/market.css';
import './styles/product.css';
import './styles/contact.css';
import './styles/manual.css';
import './styles/login.css';
import './styles/sidebar.css';
import './styles/admin.css';
import './styles/admin-extra.css';
import './styles/monitoring.css';
import './styles/registry.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
