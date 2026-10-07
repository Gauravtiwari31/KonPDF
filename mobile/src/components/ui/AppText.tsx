import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
} from 'react-native';
import {
  fonts,
  TextVariant,
  textVariants,
  ThemeColors,
  useTheme,
} from '../../theme';

type ColorRole = keyof ThemeColors;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** A theme colour role ('textMuted') or any literal colour. */
  color?: ColorRole | (string & {});
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
}

/** The only text component used by screens — enforces the type scale. */
export function AppText({
  variant = 'body',
  color = 'text',
  uppercase,
  align,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const resolved =
    color in theme.colors ? theme.colors[color as ColorRole] : color;
  return (
    <Text
      {...rest}
      style={[
        textVariants[variant],
        { color: resolved },
        uppercase && styles.uppercase,
        align && { textAlign: align },
        style,
      ]}
    />
  );
}

/**
 * Italic serif accent for a word inside a heading — the signature
 * typographic move ("Do it *all*."). Nest it inside an AppText.
 */
export function Accent({
  children,
  size,
  style,
}: {
  children: React.ReactNode;
  /** Instrument Serif runs small; pass ~1.15× the surrounding font size. */
  size: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.accent, { fontSize: size }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
  accent: { fontFamily: fonts.serifItalic, letterSpacing: -0.4 },
});
