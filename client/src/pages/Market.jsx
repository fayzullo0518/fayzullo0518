import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

import ProductCard from '../components/ProductCard.jsx';
import Footer from '../components/Footer.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];
const PAGE = 24;

function Skeletons({ n = 8 }) {
  return (
    <div className="prod-grid">
      {Array.from({ length: n }).map((_, i) => (
        <div className="sk-card" key={i}>
          <div className="sk-media sk-shimmer" />
          <div className="sk-line sk-shimmer" style={{ width: '35%' }} />
          <div className="sk-line sk-shimmer" style={{ width: '72%' }} />
          <div className="sk-line sk-shimmer" style={{ width: '55%', marginBottom: 18 }} />
        </div>
      ))}
    </div>
  );
}

export default function Market() {
  const [params, setParams] = useSearchParams();
  const { t, tCat, tCatTag } = useI18n();

  const category = params.get('category') || 'all';
  const query = params.get('q') || '';
  const sortKey = params.get('sort') || 'relevance';

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const [draft, setDraft] = useState(query);

  const SORTS = useMemo(
    () => ({
      relevance: { label: t('market.sort.relevance'), fn: null },
      'model-asc': { label: t('market.sort.modelAsc'), fn: (a, b) => a.model.localeCompare(b.model) },
      'model-desc': { label: t('market.sort.modelDesc'), fn: (a, b) => b.model.localeCompare(a.model) },
      stock: {
        label: t('market.sort.stock'),
        fn: (a, b) => Number(b.availability === 'In stock') - Number(a.availability === 'In stock'),
      },
    }),
    [t],
  );

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (category !== 'all') qs.set('category', category);
    if (query) qs.set('q', query);
    api(`/products?${qs.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setVisible(PAGE);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, query]);

  // debounce the search box into the URL
  useEffect(() => {
    if (draft === query) return undefined;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft) next.set('q', draft);
      else next.delete('q');
      setParams(next, { replace: true });
    }, 320);
    return () => clearTimeout(id);
  }, [draft, query, params, setParams]);

  const update = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
      setParams(next);
    },
    [params, setParams],
  );

  const sorted = useMemo(() => {
    const fn = SORTS[sortKey]?.fn;
    return fn ? [...items].sort(fn) : items;
  }, [items, sortKey, SORTS]);

  const activeCategory = categories.find((c) => c.id === category);
  const totalDevices = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      <div className="gh-spacer" />

      <section className="market-hero">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <span className="eyebrow">
              <span className="dot" /> {t('market.eyebrow')}
            </span>
            <h1 className="section-title">
              {activeCategory ? tCat(activeCategory) : t('market.title')}
            </h1>
            <p className="section-sub">
              {activeCategory
                ? tCatTag(activeCategory) || activeCategory.blurb
                : t('market.sub', { n: totalDevices || '—', c: categories.length || '—' })}
            </p>
          </motion.div>

          <div className="market-toolbar">
            <div className="search-field">
              <Search size={16} color="var(--text-3)" />
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('market.search')}
                aria-label={t('market.search')}
              />
              {draft && (
                <button type="button" onClick={() => setDraft('')} aria-label={t('common.close')}>
                  <X size={15} color="var(--text-3)" />
                </button>
              )}
            </div>

            <div className="market-sort">
              <SlidersHorizontal size={15} />
              <label htmlFor="sort" className="sr-only">
                {t('market.sort.relevance')}
              </label>
              <select id="sort" value={sortKey} onChange={(e) => update('sort', e.target.value)}>
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="cat-rail" role="tablist" aria-label={t('nav.catalogues')}>
            <button
              type="button"
              role="tab"
              aria-selected={category === 'all'}
              className={`cat-pill${category === 'all' ? ' active' : ''}`}
              onClick={() => update('category', 'all')}
            >
              {t('market.all')}
              <span className="n">{totalDevices || '—'}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                className={`cat-pill${category === c.id ? ' active' : ''}`}
                onClick={() => update('category', c.id)}
              >
                {tCat(c)}
                <span className="n">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 60 }}>
        <div className="container">
          <div className="results-meta">
            <span>
              {loading ? t('market.loading') : t('market.results', { n: sorted.length })}
              {query && !loading ? ` ${t('market.resultsFor', { q: query })}` : ''}
            </span>
            {(category !== 'all' || query) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setParams(new URLSearchParams())}
              >
                {t('market.reset')}
              </button>
            )}
          </div>

          {error && (
            <div className="empty-state">
              <h3>{t('market.error')}</h3>
              <p>{error}</p>
            </div>
          )}

          {loading && !error && <Skeletons n={8} />}

          {!loading && !error && sorted.length === 0 && (
            <div className="empty-state">
              <h3>{t('market.empty.t')}</h3>
              <p>{t('market.empty.b')}</p>
            </div>
          )}

          {!loading && !error && sorted.length > 0 && (
            <>
              <div className="prod-grid">
                {sorted.slice(0, visible).map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i % PAGE} />
                ))}
              </div>
              {visible < sorted.length && (
                <div className="load-more">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setVisible((v) => v + PAGE)}
                  >
                    {t('market.more', { n: Math.min(PAGE, sorted.length - visible) })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
