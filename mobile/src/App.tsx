import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { ConfirmProvider, ToastProvider } from './components/ui';
import {
  HistoryEntry,
  historyHydrated,
} from './features/history/historySlice';
import {
  preferencesHydrated,
  PreferencesState,
} from './features/preferences/preferencesSlice';
import { RootNavigator } from './navigation/RootNavigator';
import { server } from './services/server';
import { STORAGE_KEYS, storage } from './services/storage';
import { store } from './store';
import { ThemeProvider } from './theme';

/**
 * Startup: the saved engine address, preferences (so the right theme paints
 * on the first frame) and history. The engine gets a wake-up ping, so a
 * sleeping free host is ready by the time the person picks a file.
 */
async function bootstrap(): Promise<boolean> {
  await server.restore();
  server.warmUp();
  const [prefs, history, onboarded] = await Promise.all([
    storage.get<PreferencesState>(STORAGE_KEYS.preferences),
    storage.get<HistoryEntry[]>(STORAGE_KEYS.history),
    storage.get<boolean>(STORAGE_KEYS.onboarded),
  ]);
  store.dispatch(preferencesHydrated(prefs));
  store.dispatch(historyHydrated(history));
  return onboarded === true;
}

export default function App() {
  const [boot, setBoot] = useState<'loading' | 'welcome' | 'ready'>('loading');

  useEffect(() => {
    bootstrap().then(onboarded => setBoot(onboarded ? 'ready' : 'welcome'));
  }, []);

  const finishWelcome = () => {
    storage.set(STORAGE_KEYS.onboarded, true);
    setBoot('ready');
  };

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RootNavigator boot={boot} onWelcomeDone={finishWelcome} />
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
