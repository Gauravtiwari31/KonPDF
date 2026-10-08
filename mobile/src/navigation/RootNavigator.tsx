import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { DevModeIntro } from '../components/DevModeIntro';
import { TabBar } from '../components/TabBar';
import { useSharedFiles } from '../hooks/useSharedFiles';
import { ConvertScreen } from '../screens/ConvertScreen';
import { DeveloperModeScreen } from '../screens/DeveloperModeScreen';
import { EnhanceScreen } from '../screens/EnhanceScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NwScreen } from '../screens/NwScreen';
import { PdfToolsScreen } from '../screens/PdfToolsScreen';
import { ReadTextScreen } from '../screens/ReadTextScreen';
import { ResizeScreen } from '../screens/ResizeScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { ScanResultScreen } from '../screens/ScanResultScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useTheme } from '../theme';
import { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const renderTabBar = (props: React.ComponentProps<typeof TabBar>) => (
  <TabBar {...props} />
);

/** Scan · Convert · (Ask NW) · History. Convert is where the app opens. */
function MainTabs() {
  const theme = useTheme();
  return (
    <>
      <Tabs.Navigator
        initialRouteName="Home"
        tabBar={renderTabBar}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          animation: 'shift',
        }}
      >
        <Tabs.Screen name="Scan" component={ScanScreen} />
        <Tabs.Screen name="Home" component={HomeScreen} />
        <Tabs.Screen name="History" component={HistoryScreen} />
      </Tabs.Navigator>
      <DevModeIntro />
    </>
  );
}

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
        <Stack.Screen name="Main" component={MainTabs} />
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
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ScanResult" component={ScanResultScreen} />
        <Stack.Screen name="ReadText" component={ReadTextScreen} />
        <Stack.Screen name="DeveloperMode" component={DeveloperModeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
