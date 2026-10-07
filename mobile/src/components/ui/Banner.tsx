import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { palette } from '../../theme';
import { AppText } from './AppText';
import { BrutalBox } from './Brutal';
import { Icon } from './Icon';

/** Inline message box for form-level errors and notices. */
export function Banner({
  message,
  tone = 'error',
  style,
}: {
  message: string;
  tone?: 'error' | 'info';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BrutalBox
      offset={3}
      color={tone === 'error' ? palette.rose : palette.sky}
      style={style}
      contentStyle={styles.box}
    >
      <Icon
        name={tone === 'error' ? 'alert' : 'sparkle'}
        size={18}
        color={palette.ink}
      />
      <AppText variant="bodyStrong" color={palette.ink} style={styles.text}>
        {message}
      </AppText>
    </BrutalBox>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  text: { flex: 1 },
});
