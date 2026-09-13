const TOKEN_KEY = 'nova-med-token';

export const getToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore — the session simply will not persist across reloads */
  }
};

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the Gold Med Nova server. Is the API running?');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Same as api(), but a 403 resolves to `fallback` instead of throwing.
 *
 * Managers and viewers are deliberately barred from a few admin endpoints;
 * the dashboard loads all of them at once, so one refusal must not take the
 * whole page down with it.
 */
export async function apiOptional(path, options = {}, fallback = null) {
  try {
    return await api(path, options);
  } catch (err) {
    if (err.status === 403) return fallback;
    throw err;
  }
}

/**
 * Send one file as raw bytes — a third smaller than a base64 data URL, which
 * matters when an asset carries up to 50 MB of photographs.
 *
 * @param {File} file
 * @param {'image'|'doc'} kind
 * @returns {Promise<{url: string, name: string, size: number, type: string}>}
 */
export async function uploadFile(file, kind = 'image') {
  const token = getToken();
  const query = `kind=${kind}&name=${encodeURIComponent(file.name)}`;

  let res;
  try {
    res = await fetch(`/api/admin/files?${query}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
  } catch {
    throw new Error('Faylni yuborib bo‘lmadi — server bilan aloqa yo‘q.');
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || `Yuklab bo‘lmadi (${res.status})`);
  return data;
}

/**
 * Fetch a file that needs the bearer token (the Excel exports) and hand it to
 * the browser as a download — an ordinary link cannot carry the header.
 */
export async function downloadFile(path, fallbackName) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `Yuklab bo‘lmadi (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* the body was not JSON — keep the status message */
    }
    throw new Error(message);
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
