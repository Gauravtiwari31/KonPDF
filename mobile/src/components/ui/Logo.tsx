import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette, useTheme } from '../../theme';
import { Accent, AppText } from './AppText';

/**
 * The KonPDF mark: a folded page with a hard shadow, two "convert" arrows and
 * a volt dot. Same shapes as the launcher icon (ic_launcher_foreground.xml).
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="28 28 52 52">
      <Path
        d="M46,36 h17 l12,12 v25 a4,4 0 0 1 -4,4 h-25 a4,4 0 0 1 -4,-4 v-33 a4,4 0 0 1 4,-4 z"
        fill={palette.ink}
      />
      <Path
        d="M42,32 h17 l12,12 v25 a4,4 0 0 1 -4,4 h-25 a4,4 0 0 1 -4,-4 v-33 a4,4 0 0 1 4,-4 z"
        fill={palette.card}
        stroke={palette.ink}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <Path
        d="M59,32 v8 a4,4 0 0 0 4,4 h8"
        fill="none"
        stroke={palette.ink}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <Path
        d="M45,52 h16 M57,47.5 l4.5,4.5 l-4.5,4.5 M64,63 h-16 M52,58.5 l-4.5,4.5 l4.5,4.5"
        fill="none"
        stroke={palette.ink}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M30,36 a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0 z"
        fill={palette.volt}
        stroke={palette.ink}
        strokeWidth={3}
      />
    </Svg>
  );
}

/** Mark + "KonPDF" wordmark, with the brand's italic-serif "PDF". */
export function Logo({ size = 40 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <AppText
        style={{
          fontSize: size * 0.75,
          lineHeight: size,
          color: t.colors.text,
        }}
        variant="title"
      >
        Kon<Accent size={size * 0.9}>PDF</Accent>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
