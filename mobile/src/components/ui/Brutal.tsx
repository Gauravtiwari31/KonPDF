import React, { PropsWithChildren, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Theme, useTheme } from '../../theme';

interface BrutalBaseProps {
  /** Fill colour of the face. Defaults to the surface colour. */
  color?: string;
  /** Hard shadow distance; 0 disables the shadow. */
  offset?: number;
  radius?: number;
  borderColor?: string;
  shadowColor?: string;
  /** Outer container: margins, flex, alignment. */
  style?: StyleProp<ViewStyle>;
  /** The visible face: padding, size, layout of children. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Let the face grow to the height its container offers, so cards side by
   * side in a row come out the same height (Home tool tiles). Off by default:
   * in a list, React Native's legacy layout offers the whole screen height,
   * and every card would stretch to fill it.
   */
  stretch?: boolean;
}

/**
 * Shared geometry for BrutalBox / BrutalPressable.
 *
 * The outer view reserves `offset` px on the right and bottom; the shadow
 * fills the outer view minus that inset (so it is exactly face-sized, shifted
 * by `offset`) and the face grows to fill the rest. A face with a fixed width
 * (icon buttons, avatars) makes the outer view hug it — otherwise a stretching
 * parent would widen the shadow but not the face.
 *
 * A face with a fixed height never grows. React Native lays out with Yoga's
 * legacy errata, under which a flex-grow child fills all the height its parent
 * is offered; in a row aligned to `flex-start` that is the rest of the screen,
 * so the search bar's filter button stretched to the bottom of the page.
 */
function useBrutalStyles(
  t: Theme,
  {
    color,
    offset,
    radius,
    borderColor,
    shadowColor,
    contentStyle,
    stretch,
  }: BrutalBaseProps,
) {
  const o = offset ?? t.shadowOffset;
  const r = radius ?? t.radius.md;
  const faceStyle = StyleSheet.flatten(contentStyle);
  const hug = faceStyle?.width !== undefined;
  const grow = !!stretch && faceStyle?.height === undefined;
  return {
    hasShadow: o > 0,
    outer: [{ paddingRight: o, paddingBottom: o }, hug && styles.hug],
    shadow: [
      styles.shadow,
      {
        top: o,
        left: o,
        borderRadius: r,
        backgroundColor: shadowColor ?? t.colors.shadow,
      },
    ],
    face: [
      grow && styles.grow,
      {
        backgroundColor: color ?? t.colors.surface,
        borderColor: borderColor ?? t.colors.line,
        borderWidth: t.border,
        borderRadius: r,
      },
      contentStyle,
    ],
    offset: o,
  };
}

/**
 * Neo-brutalist container: thick outline plus a hard, un-blurred offset shadow.
 * Android's `elevation` can only draw soft shadows, so the shadow is a solid
 * view drawn behind the face.
 */
export function BrutalBox({
  style,
  children,
  ...props
}: PropsWithChildren<BrutalBaseProps>) {
  const s = useBrutalStyles(useTheme(), props);
  return (
    <View style={[s.outer, style]}>
      {s.hasShadow && <View style={s.shadow} />}
      <View style={s.face}>{children}</View>
    </View>
  );
}

interface BrutalPressableProps extends BrutalBaseProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: {
    selected?: boolean;
    checked?: boolean;
    disabled?: boolean;
  };
  hitSlop?: number;
  testID?: string;
}

/**
 * Pressable BrutalBox. On press the face slides into its shadow, like pushing
 * a physical key — a tactile cue that works without haptics.
 */
export function BrutalPressable({
  style,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  testID,
  children,
  ...props
}: PropsWithChildren<BrutalPressableProps>) {
  const s = useBrutalStyles(useTheme(), props);
  const press = useRef(new Animated.Value(0)).current;

  const animateTo = (value: number) =>
    Animated.spring(press, {
      toValue: value,
      useNativeDriver: true,
      speed: 60,
      bounciness: value === 0 ? 8 : 0,
    }).start();

  const shift = press.interpolate({
    inputRange: [0, 1],
    outputRange: [0, s.offset],
  });

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animateTo(1)}
      onPressOut={() => animateTo(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[s.outer, disabled && styles.disabled, style]}
    >
      {s.hasShadow && <View style={s.shadow} />}
      <Animated.View
        style={[
          s.face,
          { transform: [{ translateX: shift }, { translateY: shift }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hug: { alignSelf: 'flex-start' },
  shadow: { position: 'absolute', right: 0, bottom: 0 },
  grow: { flexGrow: 1 },
  disabled: { opacity: 0.5 },
});
