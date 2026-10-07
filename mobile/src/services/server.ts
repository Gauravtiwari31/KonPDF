import axios from 'axios';
import { useSyncExternalStore } from 'react';
import { DEFAULT_API_URL } from '../config';
import { normalizeApiUrl } from '../utils/url';
import { STORAGE_KEYS, storage } from './storage';

/**
 * The API address the app talks to. Defaults to the emulator address and can
 * be changed from the welcome screen, so a single APK works on an emulator,
 * a phone on the same Wi-Fi as the API, or against a deployed server.
 */
let current = DEFAULT_API_URL;
const listeners = new Set<() => void>();

function set(url: string) {
  current = url;
  listeners.forEach(listener => listener());
}

export const server = {
  getUrl: (): string => current,

  isDefault: (): boolean => current === DEFAULT_API_URL,

  async restore(): Promise<string> {
    const saved = await storage.get<string>(STORAGE_KEYS.apiUrl);
    set((saved && normalizeApiUrl(saved)) || DEFAULT_API_URL);
    return current;
  },

  /**
   * Fire-and-forget ping on launch. A free-tier host that went to sleep
   * starts waking up while the person is still on the welcome screen.
   */
  warmUp(): void {
    axios.get(`${current}/health`, { timeout: 60_000 }).catch(() => undefined);
  },

  async save(url: string): Promise<void> {
    set(url);
    if (url === DEFAULT_API_URL) {
      await storage.remove(STORAGE_KEYS.apiUrl);
    } else {
      await storage.set(STORAGE_KEYS.apiUrl, url);
    }
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Current API address; re-renders when it changes. */
export const useServerUrl = () =>
  useSyncExternalStore(subscribe, server.getUrl);
