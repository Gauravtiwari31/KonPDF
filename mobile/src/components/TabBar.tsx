import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { familyColors, palette, useTheme } from '../theme';
import { AppText, Icon, IconName } from './ui';

const TABS: Record<string, { label: string; icon: IconName }> = {
  Scan: { label: 'Scan', icon: 'scan' },
  Home: { label: 'Convert', icon: 'convert' },
  History: { label: 'History', icon: 'history' },
};

/**
 * The bottom bar: Scan (make documents with the camera), Convert (every
 * tool), Ask NW and History. A thick ink rule on top and a volt sticker
 * behind the current tab, like the rest of the UI. Ask NW is a button, not a
 * tab: the chat opens over everything, with room for the keyboard.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const item = (routeName: string, index: number) => {
    const meta = TABS[routeName];
    const focused = state.index === index;
    const route = state.routes[index];
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        testID={`tab-${routeName}`}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.item}
      >
        <View
          style={[
            styles.pill,
            focused && {
              backgroundColor: palette.volt,
              borderColor: t.colors.line,
            },
          ]}
        >
          <Icon
            name={meta.icon}
            size={22}
            color={focused ? palette.ink : t.colors.textMuted}
            strokeWidth={focused ? 2.6 : 2.2}
          />
        </View>
        <AppText
          variant="label"
          color={focused ? t.colors.text : t.colors.textMuted}
          style={styles.label}
        >
          {meta.label}
        </AppText>
      </Pressable>
    );
  };

  const index = (name: string) => state.routes.findIndex(r => r.name === name);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.line,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {item('Scan', index('Scan'))}
      {item('Home', index('Home'))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask NW, the assistant"
        testID="tab-nw"
        onPress={() => {
          navigation.getParent()?.navigate('Nw');
        }}
        style={styles.item}
      >
        <View
          style={[
            styles.nw,
            { backgroundColor: familyColors.nw, borderColor: t.colors.line },
          ]}
        >
          <AppText variant="label" color={palette.ink}>
            NW
          </AppText>
        </View>
        <AppText variant="label" color={t.colors.textMuted} style={styles.label}>
          Ask NW
        </AppText>
      </Pressable>
      {item('History', index('History'))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 2.5,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  pill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nw: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11 },
});
