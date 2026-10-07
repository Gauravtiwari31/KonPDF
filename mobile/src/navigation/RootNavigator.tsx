import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useSharedFiles } from '../hooks/useSharedFiles';
import { ConvertScreen } from '../screens/ConvertScreen';
import { EnhanceScreen } from '../screens/EnhanceScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NwScreen } from '../screens/NwScreen';
import { PdfToolsScreen } from '../screens/PdfToolsScreen';
import { ResizeScreen } from '../screens/ResizeScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useTheme } from '../theme';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator({
  boot,
  onWelcomeDone,
}: {
  boot: 'loading' | 'welcome' | 'ready';
  onWelcomeDone: () => void;
}) {
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  useSharedFiles(navigationRef, boot === 'ready');

  // Keep react-navigation's own surfaces (transitions, overscroll) on-palette.
  const navTheme = useMemo<NavTheme>(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.line,
        primary: theme.colors.primary,
      },
    };
  }, [theme]);

  if (boot === 'loading') {
    return <SplashScreen />;
  }
  if (boot === 'welcome') {
    return <WelcomeScreen onDone={onWelcomeDone} />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Convert" component={ConvertScreen} />
        <Stack.Screen name="Resize" component={ResizeScreen} />
        <Stack.Screen name="Enhance" component={EnhanceScreen} />
        <Stack.Screen name="PdfTools" component={PdfToolsScreen} />
        <Stack.Screen
          name="Nw"
          component={NwScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ animation: 'fade_from_bottom' }}
        />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
