/**
 * Turns what a person types into a usable base URL:
 *   "192.168.1.20:8000"          → "http://192.168.1.20:8000/api"
 *   "https://konpdf.example.com/" → "https://konpdf.example.com/api"
 * Returns null when there is no host to talk to.
 */
export function normalizeApiUrl(input: string): string | null {
  const match = input
    .trim()
    .match(
      /^(https?:\/\/)?([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d{1,5})?(\/[^\s?#]*)?$/i,
    );
  if (!match) {
    return null;
  }
  const [, scheme = 'http://', host, port = '', rawPath = ''] = match;
  const path = rawPath.replace(/\/+$/, '') || '/api';
  return `${scheme.toLowerCase()}${host}${port}${path}`;
}

/** "http://192.168.1.20:8000/api" → "192.168.1.20:8000" (for compact display). */
export const displayHost = (url: string) =>
  url.replace(/^https?:\/\//, '').replace(/\/api$/, '');

/**
 * Origin of the site an API base URL belongs to, where the server's own web
 * pages live:
 *   "https://konpdf.example.com/api" → "https://konpdf.example.com"
 *   "http://10.0.2.2:8000/api"      → "http://10.0.2.2:8000"
 */
export const siteOrigin = (apiUrl: string) =>
  apiUrl.replace(/^(https?:\/\/[^/]+).*$/i, '$1');
