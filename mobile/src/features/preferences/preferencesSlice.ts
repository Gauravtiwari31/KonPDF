import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LangPreference } from '../../i18n/languages';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PreferencesState {
  themeMode: ThemeMode;
  /** Language for NW and error messages; 'auto' follows the phone. */
  language: LangPreference;
  /** Default quality for JPG/WEBP output, 1–100. */
  quality: number;
}

export const initialPreferences: PreferencesState = {
  themeMode: 'system',
  language: 'auto',
  quality: 88,
};

/** Device-level preferences, persisted by the listener in store/listeners.ts. */
const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: initialPreferences,
  reducers: {
    preferencesHydrated(
      state,
      action: PayloadAction<Partial<PreferencesState> | null>,
    ) {
      return { ...state, ...action.payload };
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setLanguage(state, action: PayloadAction<LangPreference>) {
      state.language = action.payload;
    },
    setQuality(state, action: PayloadAction<number>) {
      state.quality = Math.round(Math.min(100, Math.max(1, action.payload)));
    },
  },
});

export const { preferencesHydrated, setThemeMode, setLanguage, setQuality } =
  preferencesSlice.actions;
export default preferencesSlice.reducer;
