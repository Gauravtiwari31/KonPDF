import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

/** "— WHEN" style mono label used to separate form sections. */
export function SectionLabel({
  children,
  right,
  style,
}: {
  children: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.rule, { backgroundColor: t.colors.text }]} />
      <AppText variant="label" uppercase style={styles.text}>
        {children}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rule: { width: 14, height: 2 },
  text: { flex: 1 },
});
