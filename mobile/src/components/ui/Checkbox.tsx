import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { palette, useTheme } from '../../theme';
import { Icon } from './Icon';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  label: string;
}

/** Chunky square checkbox with a little "pop" when ticked. */
export function Checkbox({
  checked,
  onToggle,
  size = 30,
  label,
}: CheckboxProps) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 14,
    }).start();
  }, [checked, scale]);

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            borderColor: t.colors.line,
            borderWidth: t.border,
            backgroundColor: checked ? t.colors.highlight : t.colors.surface,
            transform: [{ scale }],
          },
        ]}
      >
        {checked ? (
          <Icon
            name="check"
            size={size * 0.7}
            color={palette.ink}
            strokeWidth={3.2}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
