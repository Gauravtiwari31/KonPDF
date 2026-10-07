/**
 * Languages NW and error messages speak. The engine localises its own errors
 * and NW's replies from the Accept-Language header; the app localises the
 * few problems that never reach the engine (no internet, no app to open a
 * file...) from the same list.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'hi-Latn', label: 'Hinglish' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
export type LangPreference = 'auto' | Lang;

const CODES = new Set<string>(LANGUAGES.map(l => l.code));

/** The phone's language if KonPDF speaks it, else English. */
export function deviceLang(): Lang {
  let locale = 'en';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    // Older engines without Intl: English.
  }
  const base = locale.split(/[-_]/)[0].toLowerCase();
  return CODES.has(base) ? (base as Lang) : 'en';
}

export const resolveLang = (pref: LangPreference): Lang =>
  pref === 'auto' ? deviceLang() : pref;
