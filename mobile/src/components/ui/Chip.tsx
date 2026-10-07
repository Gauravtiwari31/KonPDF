import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { palette, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Fill colour when selected (defaults to the inverse/ink colour). */
  color?: string;
  /** Small colour dot shown before the label. */
  dot?: string;
  count?: number;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** Pill used for filters, presets and pickers. */
export function Chip({
  label,
  selected,
  onPress,
  color,
  dot,
  count,
  icon,
  style,
}: ChipProps) {
  const t = useTheme();
  const fill = selected ? color ?? t.colors.inverse : t.colors.surface;
  const fg = selected
    ? color
      ? palette.ink
      : t.colors.onInverse
    : t.colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: fill,
          borderColor: t.colors.line,
          borderWidth: t.border,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        style,
      ]}
    >
      {dot ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: dot, borderColor: t.colors.line },
          ]}
        />
      ) : null}
      {icon ? (
        <Icon name={icon} size={15} color={fg} strokeWidth={2.6} />
      ) : null}
      <AppText variant="bodyStrong" color={fg} style={styles.label}>
        {label}
      </AppText>
      {count !== undefined ? (
        <View
          style={[
            styles.count,
            {
              backgroundColor: selected
                ? t.colors.highlight
                : t.colors.surfaceAlt,
            },
          ]}
        >
          <AppText
            variant="mono"
            color={selected ? palette.ink : t.colors.textMuted}
          >
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  label: { fontSize: 14 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5 },
  count: {
    minWidth: 22,
    paddingHorizontal: 5,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
