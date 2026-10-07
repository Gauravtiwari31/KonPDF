import React, { PropsWithChildren } from 'react';
import {
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScreenProps {
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

/** Root container for every screen: themed background, safe areas, status bar. */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  style,
}: PropsWithChildren<ScreenProps>) {
  const t = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: t.colors.background }]}
    >
      {/* Edge-to-edge: the bar is transparent, we only pick icon colours. */}
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />
      <View style={[styles.root, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
