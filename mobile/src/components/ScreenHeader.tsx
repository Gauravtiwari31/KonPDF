import { useNavigation } from '@react-navigation/native';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, IconButton } from './ui';

/**
 * Back button, mono kicker and a big title: the top of every inner screen.
 * Tabs have no back button (`back={false}`); their actions stay on the right.
 */
export function ScreenHeader({
  kicker,
  title,
  right,
  back = true,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
  back?: boolean;
}) {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, !back && styles.barEnd]}>
        {back ? (
          <IconButton
            icon="arrowLeft"
            label="Back"
            onPress={() => navigation.goBack()}
          />
        ) : null}
        {right}
      </View>
      {kicker ? (
        <AppText variant="label" color="textMuted" uppercase>
          {kicker}
        </AppText>
      ) : null}
      <AppText variant="title">{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 20 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  barEnd: { justifyContent: 'flex-end', minHeight: 44 },
});
