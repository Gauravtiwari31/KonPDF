import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { palette, shadowFor, useTheme } from '../../theme';
import { AppText } from './AppText';
import { BrutalPressable } from './Brutal';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'dark' | 'outline' | 'highlight' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'right',
  loading,
  disabled,
  style,
  testID,
}: ButtonProps) {
  const t = useTheme();
  const fills: Record<Variant, { bg: string; fg: string }> = {
    primary: { bg: t.colors.primary, fg: t.colors.onPrimary },
    dark: { bg: t.colors.inverse, fg: t.colors.onInverse },
    outline: { bg: t.colors.surface, fg: t.colors.text },
    highlight: { bg: t.colors.highlight, fg: palette.ink },
    danger: { bg: t.colors.danger, fg: palette.card },
  };
  const { bg, fg } = fills[variant];
  const height = size === 'lg' ? 56 : 46;

  const iconEl = icon ? (
    <Icon name={icon} size={size === 'lg' ? 20 : 18} color={fg} />
  ) : null;

  return (
    <BrutalPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      color={bg}
      shadowColor={shadowFor(t, bg)}
      radius={t.radius.md}
      style={style}
      accessibilityLabel={title}
      contentStyle={[styles.face, { height }]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {iconPosition === 'left' && iconEl}
          <AppText
            variant={size === 'lg' ? 'subheading' : 'bodyStrong'}
            color={fg}
          >
            {title}
          </AppText>
          {iconPosition === 'right' && iconEl}
        </View>
      )}
    </BrutalPressable>
  );
}

/** Square icon-only button (back, close, settings...). */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 44,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <BrutalPressable
      onPress={onPress}
      accessibilityLabel={label}
      color={color ?? t.colors.surface}
      offset={3}
      radius={t.radius.sm + 4}
      hitSlop={6}
      style={style}
      contentStyle={[styles.iconFace, { width: size, height: size }]}
    >
      <Icon name={icon} size={20} color={color ? palette.ink : t.colors.text} />
    </BrutalPressable>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconFace: { alignItems: 'center', justifyContent: 'center' },
});
