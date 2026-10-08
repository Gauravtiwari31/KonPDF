import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { setEngineLanguage } from '../api/engine';
import {
  entryAdded,
  entryRemoved,
  historyCleared,
} from '../features/history/historySlice';
import {
  preferencesHydrated,
  setDeveloperMode,
  setLanguage,
  setQuality,
  setReader,
  setThemeMode,
  setWifiOnly,
} from '../features/preferences/preferencesSlice';
import { resolveLang } from '../i18n/languages';
import { files } from '../services/files';
import { STORAGE_KEYS, storage } from '../services/storage';
import type { AppDispatch, RootState } from './index';

/** Side effects that react to actions (kept out of reducers, which must stay pure). */
export const listener = createListenerMiddleware();

const startListening = listener.startListening.withTypes<
  RootState,
  AppDispatch
>();

// Persist device preferences whenever they change.
startListening({
  matcher: isAnyOf(
    setThemeMode,
    setLanguage,
    setQuality,
    setDeveloperMode,
    setWifiOnly,
    setReader,
  ),
  effect: async (_action, api) => {
    await storage.set(STORAGE_KEYS.preferences, api.getState().preferences);
  },
});

// The engine answers (errors, NW) in the chosen language.
startListening({
  matcher: isAnyOf(preferencesHydrated, setLanguage),
  effect: (_action, api) => {
    setEngineLanguage(resolveLang(api.getState().preferences.language));
  },
});

// History: persist, and delete the cached copies of results that leave it.
startListening({
  matcher: isAnyOf(entryAdded, entryRemoved, historyCleared),
  effect: async (action, api) => {
    const before = api.getOriginalState().history.entries;
    const after = api.getState().history.entries;
    const kept = new Set(after.flatMap(e => e.outputs.map(f => f.path)));
    before
      .flatMap(e => e.outputs)
      .filter(f => !kept.has(f.path))
      .forEach(f => files.remove(f));
    await storage.set(STORAGE_KEYS.history, after);
  },
});
