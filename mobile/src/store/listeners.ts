import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { setEngineLanguage } from '../api/engine';
import { runQueue } from '../features/drive/backup';
import {
  backupRequested,
  backupsPruned,
  driveConnected,
  driveHydrated,
  waitingIds,
} from '../features/drive/driveSlice';
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
    // Entries that left History leave the Drive backup list too (their
    // files stay in Drive).
    const ids = after.map(e => e.id);
    const backups = Object.keys(api.getState().drive.backups);
    if (backups.some(id => !ids.includes(id))) {
      api.dispatch(backupsPruned(ids));
    }
  },
});

// Google Drive backup (optional): persist its state on every change.
startListening({
  predicate: action =>
    action.type.startsWith('drive/') && !driveHydrated.match(action),
  effect: async (_action, api) => {
    await storage.set(STORAGE_KEYS.drive, api.getState().drive);
  },
});

// New results go to Drive by themselves when automatic backup is on.
startListening({
  actionCreator: entryAdded,
  effect: (action, api) => {
    const { drive } = api.getState();
    if (drive.account && drive.autoBackup && !drive.needsReconnect) {
      api.dispatch(backupRequested([action.payload.id]));
    }
  },
});

// On start-up and after (re)connecting, catch up on results still waiting.
startListening({
  matcher: isAnyOf(driveHydrated, driveConnected),
  effect: (_action, api) => {
    const { drive, history } = api.getState();
    const ids = waitingIds(drive, history.entries);
    if (ids.length) {
      api.dispatch(backupRequested(ids));
    }
  },
});

// Uploads run one at a time in the background.
startListening({
  actionCreator: backupRequested,
  effect: (_action, api) => runQueue(api.dispatch, api.getState),
});
