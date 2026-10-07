import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin JSON wrapper over AsyncStorage. Storage failures are logged and
 * swallowed: losing a cached preference must never crash the app.
 */
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      console.warn(`[storage] failed to read "${key}"`, error);
      return null;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[storage] failed to write "${key}"`, error);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`[storage] failed to remove "${key}"`, error);
    }
  },
};

export const STORAGE_KEYS = {
  preferences: 'konpdf.preferences.v1',
  apiUrl: 'konpdf.apiUrl.v1',
  history: 'konpdf.history.v1',
  /** Set once the welcome screen has been seen. */
  onboarded: 'konpdf.onboarded.v1',
} as const;
