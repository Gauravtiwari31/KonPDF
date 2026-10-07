import React from 'react';
import { StyleSheet, View } from 'react-native';

const DASHES = Array.from({ length: 60 }, (_, i) => i);

/**
 * Horizontal dashed line. Android can't draw a dashed border on a single side
 * (it silently falls back to solid), so the dashes are drawn as views.
 */
export function DashedRule({ color }: { color: string }) {
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {DASHES.map(i => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, height: 2, overflow: 'hidden' },
  dash: { width: 8, height: 2 },
});
