import React, { PropsWithChildren } from 'react';
import {
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useTheme } from '../../theme';

interface ScreenProps {
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

/** Root container for every screen: themed background, safe areas, status bar, keyboard. */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  style,
}: PropsWithChildren<ScreenProps>) {
  const t = useTheme();
  // Make room for the keyboard, like Android's adjustResize would without
  // edge-to-edge: text boxes at the bottom (NW chat) stay visible.
  const keyboardHeight = useKeyboardHeight();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: t.colors.background }]}
    >
      {/* Edge-to-edge: the bar is transparent, we only pick icon colours. */}
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.root,
          style,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
