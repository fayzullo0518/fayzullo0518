import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

import { useI18n } from '../lib/i18n.jsx';
import { useReference, standardRows } from '../lib/reference.js';

const EASE = [0.16, 1, 0.3, 1];

/**
 * A device card: the photograph, the name and the headline parameters, with
 * “more information” opening the full page. On a phone this is the whole of
 * what a visitor sees before they tap through.
 */
export default function ProductCard({ product, index = 0, specLimit = 2 }) {
  const navigate = useNavigate();
  const { t, tr, tVal } = useI18n();
  const { specTemplate } = useReference();
  const open = () => navigate(`/product/${product.id}`);

  /* prefer the standard sheet, fall back to the device's own rows */
  const headline = standardRows(specTemplate, product.standard, tr)
    .filter((row) => row.primary && row.value)
    .slice(0, specLimit);
  const rows = headline.length
    ? headline
    : (product.specs || []).slice(0, specLimit).map((s) => ({ key: s.label, ...s }));

  return (
    <motion.article
      className="prod-card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`${product.model} — ${product.name}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="prod-media">
        <img src={product.image} alt={`${product.model} ${product.name}`} loading="lazy" />
        {product.subcategory && <span className="prod-badge">{product.subcategory}</span>}
        <span className={`prod-stock${product.availability === 'In stock' ? '' : ' order'}`}>
          {tVal(product.availability)}
        </span>
      </div>

      <div className="prod-body">
        <span className="prod-model">{product.model}</span>
        <h3 className="prod-name">{product.name}</h3>

        {rows.length > 0 && (
          <div className="prod-specs">
            {rows.map((row) => (
              <div key={row.key}>
                <span>{row.label}</span>
                <b>{row.value}</b>
              </div>
            ))}
          </div>
        )}

        <div className="prod-foot">
          <span className="prod-price">{product.price || t('market.priceOnRequest')}</span>
          <span className="prod-cta">
            {t('spec.more')} <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
    </motion.article>
  );
}
