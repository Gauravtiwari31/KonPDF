import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Checkbox, Chip } from './ui';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  color?: string;
};

/** A wrapping row of chips where exactly one is selected. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map(o => (
        <Chip
          key={o.value}
          label={o.label}
          color={o.color}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

/** Checkbox with a label and an optional explanation underneath. */
export function ToggleRow({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggle} accessible={false}>
      <Checkbox checked={checked} onToggle={onToggle} label={label} size={26} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="textMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
