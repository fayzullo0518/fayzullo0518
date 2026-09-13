import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { X, ExternalLink, Pencil, Trash2, BookOpenCheck, ShieldCheck } from 'lucide-react';

import { useI18n } from '../../lib/i18n.jsx';

const EASE = [0.16, 1, 0.3, 1];

/** Quick look at a device from the products table — no navigation needed. */
export default function ProductPreviewModal({ product, categoryName, manual, onClose, onEdit, onDelete, canEdit }) {
  const { t, tVal } = useI18n();

  return (
    <div className="adm-modal-bg" onClick={onClose} role="presentation">
      <motion.div
        className="adm-modal adm-modal-wide"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
        role="dialog"
        aria-modal="true"
      >
        <div className="pv-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="pv-model">{product.model}</span>
            <h3>{product.name}</h3>
            <p className="sub">
              {categoryName} · {product.subcategory}
              {product.custom && ` · ${t('admin.custom')}`}
            </p>
          </div>
          <button type="button" className="row-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="pv-body">
          <div className="pv-media">
            <img src={product.image} alt={`${product.model} ${product.name}`} />
          </div>

          <div className="pv-info">
            {product.summary && <p className="pv-summary">{product.summary}</p>}

            <div className="pv-facts">
              <div>
                <em>{t('product.availability')}</em>
                <b>{tVal(product.availability)}</b>
              </div>
              <div>
                <em>{t('product.leadTime')}</em>
                <b>{tVal(product.leadTime)}</b>
              </div>
              <div>
                <em>{t('product.warranty')}</em>
                <b>{tVal(product.warranty)}</b>
              </div>
              <div>
                <em>{t('product.price')}</em>
                <b>{product.price || t('product.onRequest')}</b>
              </div>
            </div>

            {product.specs?.length > 0 && (
              <div className="spec-table" style={{ marginTop: 16 }}>
                {product.specs.map((s) => (
                  <div key={s.label}>
                    <span>{s.label}</span>
                    <b>{s.value}</b>
                  </div>
                ))}
                <div>
                  <span>{t('product.sku')}</span>
                  <b>{product.sku}</b>
                </div>
                <div>
                  <span>{t('product.cert')}</span>
                  <b>
                    <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    {(product.certifications || ['CE']).join(' · ')}
                  </b>
                </div>
              </div>
            )}

            {manual && (
              <Link className="pv-manual" to={`/manual/${manual.id}`} target="_blank">
                <BookOpenCheck size={16} />
                <span>
                  <b>{t('product.manual')}</b>
                  <em>{manual.title}</em>
                </span>
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </div>

        <div className="adm-modal-actions">
          <Link className="btn btn-ghost" to={`/product/${product.id}`} target="_blank">
            <ExternalLink size={14} /> {t('common.open')}
          </Link>
          {canEdit && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => onEdit(product)}>
                <Pencil size={14} /> {t('common.edit')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => onDelete(product)}
              >
                <Trash2 size={14} /> {t('common.delete')}
              </button>
            </>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
