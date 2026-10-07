import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { FriendlyError } from '../api/errors';
import { palette } from '../theme';
import { AppText, BrutalBox, Icon } from './ui';

/**
 * How every problem is shown: a title, one plain sentence and what to try.
 * Never a status code. "Ask NW" opens the assistant with the error, for a
 * longer explanation in the person's language.
 */
export function ErrorCard({
  error,
  onAskNw,
  onRetry,
  style,
}: {
  error: FriendlyError;
  onAskNw?: () => void;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BrutalBox color={palette.rose} style={style} contentStyle={styles.box}>
      <View style={styles.head}>
        <Icon name="alert" size={20} color={palette.ink} />
        <AppText variant="subheading" color={palette.ink} style={styles.flex}>
          {error.title}
        </AppText>
      </View>
      <AppText color={palette.ink}>{error.message}</AppText>
      {error.hint ? (
        <AppText variant="caption" color={palette.inkSoft}>
          {error.hint}
        </AppText>
      ) : null}
      {onAskNw || onRetry ? (
        <View style={styles.actions}>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.action}
            >
              <Icon name="refresh" size={16} color={palette.ink} />
              <AppText variant="label" uppercase color={palette.ink}>
                Try again
              </AppText>
            </Pressable>
          ) : null}
          {onAskNw ? (
            <Pressable
              onPress={onAskNw}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.action}
            >
              <Icon name="chat" size={16} color={palette.ink} />
              <AppText variant="label" uppercase color={palette.ink}>
                Ask NW
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </BrutalBox>
  );
}

const styles = StyleSheet.create({
  box: { padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 20, marginTop: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
