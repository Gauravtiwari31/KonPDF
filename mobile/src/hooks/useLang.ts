import { Lang, resolveLang } from '../i18n/languages';
import { useAppSelector } from '../store/hooks';

/** The language NW and error messages use right now. */
export const useLang = (): Lang =>
  resolveLang(useAppSelector(state => state.preferences.language));
