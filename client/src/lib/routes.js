/**
 * The dashboard has no link anywhere on the public site. It lives behind
 * unlisted addresses, which show the sign-in card while nobody is signed in
 * and the dashboard itself once they are.
 *
 * Two spellings are accepted — /adm1n and /dev — so either one works.
 */
export const ADMIN_PATH = '/adm1n';
export const ADMIN_PATHS = ['/adm1n', '/dev'];

export const isAdminPath = (pathname) =>
  ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** where a printed QR label points */
export const qrPath = (assetId) => `/q/${assetId}`;
export const qrUrl = (assetId) => `${window.location.origin}${qrPath(assetId)}`;
