import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Fill colour when selected. */
  color?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Row of equal-width toggle tiles (priority picker, theme picker). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: t.colors.line,
          borderWidth: t.border,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.surface,
        },
      ]}
    >
      {options.map(option => {
        const selected = option.value === value;
        const fill = selected
          ? option.color ?? t.colors.inverse
          : 'transparent';
        const fg = selected
          ? option.color
            ? palette.ink
            : t.colors.onInverse
          : t.colors.text;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[
              styles.cell,
              selected ? { borderColor: t.colors.line } : styles.cellIdle,
              { backgroundColor: fill, borderRadius: t.radius.md - 4 },
            ]}
          >
            {option.icon ? (
              <Icon name={option.icon} size={17} color={fg} />
            ) : null}
            <AppText variant="bodyStrong" color={fg}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, gap: 4 },
  cellIdle: { borderColor: 'transparent' },
  cell: {
    flex: 1,
    borderWidth: 2,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
