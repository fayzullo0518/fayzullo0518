import QRCode from 'react-qr-code';

/**
 * A scannable QR code with the handle written underneath it — used for the
 * Instagram, Telegram and e-mail channels in the footer and on the contact page.
 */
export default function QrCard({ label, handle, url, size = 84 }) {
  return (
    <a
      className="qr-card"
      href={url}
      target={url.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      title={`${label}: ${handle}`}
    >
      <span className="qr-frame">
        <QRCode
          value={url}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#101828"
          level="M"
          style={{ height: 'auto', maxWidth: '100%', width: size }}
        />
      </span>
      <span className="qr-cap">
        <b>{label}</b>
        <span>{handle}</span>
      </span>
    </a>
  );
}
