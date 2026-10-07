import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import { useAppSelector } from '../store/hooks';
import { darkTheme, lightTheme, Theme } from './themes';

const ThemeContext = createContext<Theme>(lightTheme);

/**
 * Resolves the active theme from the user's preference (system / light / dark,
 * stored in Redux) and the OS colour scheme.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const mode = useAppSelector(state => state.preferences.themeMode);
  const system = useColorScheme();
  const theme = useMemo(() => {
    const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return dark ? darkTheme : lightTheme;
  }, [mode, system]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
