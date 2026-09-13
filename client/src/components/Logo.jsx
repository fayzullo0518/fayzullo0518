import { Link } from 'react-router-dom';

/**
 * The Gold Med Nova mark — the gilded caduceus from the company emblem, with
 * the white ground knocked out so it sits on either theme.
 *
 * The "GOLD MED NOVA" wordmark is deliberately NOT part of the image: the name
 * is set in live text beside the mark, so it stays crisp at every size, follows
 * the theme, and can be translated. Small places (the dashboard rail, the
 * browser tab, a QR label) use the mark on its own.
 *
 * `tone="mono"` drops the colour for surfaces that are strictly black & white.
 */
export function LogoMark({ size = 22, className = '' }) {
  // the emblem is wider than it is tall, so height drives it and width follows
  return (
    <img
      className={`nm-logo-mark ${className}`}
      src="/logo-mark.png"
      style={{ height: size, width: 'auto' }}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}

export default function Logo({ size = 22, tone = 'brand', to = '/', className = '' }) {
  const mono = tone === 'mono';
  return (
    <Link to={to} className={`nm-logo ${className}`} aria-label="Gold Med Nova — home">
      <LogoMark size={size * 1.5} />
      <span className="nm-logo-text">
        <span style={{ color: mono ? 'inherit' : 'var(--logo-ink)' }}>Gold Med</span>
        <span style={{ color: mono ? 'inherit' : 'var(--nm-blue)' }}> Nova</span>
      </span>
    </Link>
  );
}
