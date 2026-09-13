import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';
import { ArrowRight, Phone, Send } from 'lucide-react';

import ProductCard from '../components/ProductCard.jsx';
import Footer from '../components/Footer.jsx';
import { api } from '../lib/api.js';
import { useContacts } from '../lib/contact.js';
import { useI18n } from '../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4';

/* ------------------------------------------------------------------ */
/* hero                                                               */
/* ------------------------------------------------------------------ */

/**
 * The landing hero is the background film on its own — the scanner cut-out that
 * used to float over it was taking attention away from the footage.
 */
function Hero() {
  const heroRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const { t } = useI18n();

  return (
    <section className="hero" ref={heroRef}>
      {/* ---- background video, behind everything (z 0) ---- */}
      <motion.div
        className="hero-video-wrap"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.8, ease: EASE }}
      >
        <div className="hero-video-inner">
          {videoFailed ? (
            <div className="hero-video-fallback" />
          ) : (
            <video
              src={VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setVideoFailed(true)}
              aria-hidden="true"
            />
          )}
        </div>
      </motion.div>

      {/* ---- pinned footer content (z 30) ---- */}
      <motion.div
        className="hero-foot"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: EASE }}
      >
        <div>
          <motion.div
            className="hero-sub"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          >
            <span className="dot" />
            {t('hero.subtitle')}
          </motion.div>

          <motion.h1
            className="hero-heading"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
          >
            <span>{t('hero.h1')}</span>
            <span>{t('hero.h2')}</span>
          </motion.h1>

          <motion.div
            className="hero-cta"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 1, ease: EASE }}
          >
            <Link to="/market" className="btn hero-cta-dark">
              {t('hero.cta1')}
            </Link>
            <a href="#how" className="btn hero-cta-ghost">
              {t('hero.cta2')}
            </a>
          </motion.div>
        </div>

        <div className="hero-foot-tags">
          <span>{t('hero.chip1')}</span>
          <span>{t('hero.chip2')}</span>
          <span>{t('hero.chip3')}</span>
        </div>
      </motion.div>

      <div className="hero-scrollhint" aria-hidden="true">
        <span className="bar" />
        {t('hero.scroll')}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* marquee strip                                                      */
/* ------------------------------------------------------------------ */

const STRIP_KEYS = Array.from({ length: 12 }, (_, i) => `strip.${i + 1}`);

function Strip() {
  const { t } = useI18n();
  const items = STRIP_KEYS.map((k) => t(k));
  return (
    <div className="home-strip" aria-hidden="true">
      <motion.div
        className="home-strip-track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {[...items, ...items].map((s, i) => (
          <span key={`${s}-${i}`}>{s}</span>
        ))}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* scroll-driven "how it works"                                       */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const soft = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.4 });
  const y = useTransform(soft, [0, 1], reduce ? [0, 0] : [70, -70]);
  const rotate = useTransform(soft, [0, 1], reduce ? [0, 0] : [4, -4]);
  const scale = useTransform(soft, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.92, 1.02, 0.94]);

  const steps = [
    [t('home.how.s1.t'), t('home.how.s1.b')],
    [t('home.how.s2.t'), t('home.how.s2.b')],
    [t('home.how.s3.t'), t('home.how.s3.b')],
    [t('home.how.s4.t'), t('home.how.s4.b')],
  ];

  return (
    <section className="scan-section" id="how" ref={ref}>
      <div className="container">
        <div className="scan-layout">
          <div className="scan-stage">
            <span className="scan-glow" aria-hidden="true" />
            <motion.img src="/mri-scanner.png" alt="" style={{ y, rotate, scale }} loading="lazy" />
          </div>

          <div>
            <span className="eyebrow">
              <span className="dot" /> {t('home.how.eyebrow')}
            </span>
            <h2 className="section-title">
              {t('home.how.title1')}
              <br />
              {t('home.how.title2')}
            </h2>
            <p className="section-sub">{t('home.how.sub')}</p>

            <div className="scan-steps">
              {steps.map(([title, body], i) => (
                <motion.div
                  className="scan-step"
                  key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                >
                  <span className="n">{i + 1}</span>
                  <div>
                    <h4>{title}</h4>
                    <p>{body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { t, tCat, tCatTag } = useI18n();
  const contacts = useContacts();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api('/categories'), api('/products/featured')])
      .then(([cats, feat]) => {
        if (cancelled) return;
        setCategories(cats);
        setFeatured(feat);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalProducts = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      <Hero />
      <Strip />

      {/* ---------- catalogues ---------- */}
      <section className="section" id="catalogues">
        <div className="container">
          <span className="eyebrow">
            <span className="dot" /> {t('home.cats.eyebrow')}
          </span>
          <h2 className="section-title">
            {t('home.cats.title1')}
            <br />
            {t('home.cats.title2')}
          </h2>
          <p className="section-sub">{t('home.cats.sub')}</p>

          {error && (
            <div className="empty-state" style={{ marginTop: 28 }}>
              <h3>{t('market.error')}</h3>
              <p>{error}</p>
            </div>
          )}

          <div className="cat-grid">
            {categories.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.05, ease: EASE }}
              >
                <Link className="cat-card" to={`/market?category=${c.id}`}>
                  <span className="cat-accent" style={{ background: c.accent }} />
                  <h3>{tCat(c)}</h3>
                  <p>{tCatTag(c)}</p>
                  <span className="cat-count">
                    {c.count} {t('home.cats.devices')} →
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="stat-band">
            <div className="stat-cell">
              <b>{totalProducts || '—'}</b>
              <span>{t('home.stats.devices')}</span>
            </div>
            <div className="stat-cell">
              <b>{categories.length || '—'}</b>
              <span>{t('home.stats.catalogues')}</span>
            </div>
            <div className="stat-cell">
              <b>24 mo</b>
              <span>{t('home.stats.warranty')}</span>
            </div>
            <div className="stat-cell">
              <b>14</b>
              <span>{t('home.stats.regions')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- one product from every catalogue ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <span className="eyebrow">
            <span className="dot" /> {t('home.feat.eyebrow')}
          </span>
          <h2 className="section-title">
            {t('home.feat.title1')}
            <br />
            {t('home.feat.title2')}
          </h2>
          <p className="section-sub">{t('home.feat.sub')}</p>

          <div className="feat-grid">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} specLimit={3} />
            ))}
          </div>

          <div className="load-more">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/market')}>
              {t('home.feat.openMarket')} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* ---------- contact CTA ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <div>
              <h3>
                {t('home.cta.title1')}
                <br />
                {t('home.cta.title2')}
              </h3>
              <p>{t('home.cta.body')}</p>
              <div className="cta-actions" style={{ marginTop: 20 }}>
                {contacts.admins.map((a) => (
                  <a key={a.id} className="btn btn-light" href={a.phoneHref}>
                    <Phone size={14} /> {a.name} · {a.phone}
                  </a>
                ))}
                {contacts.channels[1] && (
                  <a
                    className="btn btn-outline"
                    href={contacts.channels[1].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send size={14} /> {contacts.channels[1].handle}
                  </a>
                )}
              </div>
            </div>
            <Link to="/contact" className="btn btn-light">
              {t('home.cta.page')} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
