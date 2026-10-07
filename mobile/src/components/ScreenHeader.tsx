import { useNavigation } from '@react-navigation/native';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, IconButton } from './ui';

/** Back button, mono kicker and a big title: the top of every inner screen. */
export function ScreenHeader({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
}) {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <IconButton
          icon="arrowLeft"
          label="Back"
          onPress={() => navigation.goBack()}
        />
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
});
