import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalPressable,
  Icon,
  IconButton,
  Screen,
  useConfirm,
} from '../components/ui';
import { historyCleared } from '../features/history/historySlice';
import type { TabProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { familyColors, palette, useTheme } from '../theme';
import { formatBytes, formatWhen } from '../utils/format';

/** Past results, kept on this phone only. */
export function HistoryScreen({ navigation }: TabProps<'History'>) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const entries = useAppSelector(state => state.history.entries);

  const clear = async () => {
    const ok = await confirm({
      title: 'Clear history?',
      message: 'Your results will be removed from this phone.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (ok) {
      dispatch(historyCleared());
    }
  };

  return (
    <Screen edges={['top']}>
      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <ScreenHeader
            back={false}
            kicker="On this phone"
            title="History"
            right={
              entries.length ? (
                <IconButton icon="trash" label="Clear history" onPress={clear} />
              ) : null
            }
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={36} color={t.colors.textMuted} />
            <AppText color="textMuted" align="center">
              Nothing here yet. Results you make show up here, so you can open
              or share them again.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <BrutalPressable
            offset={3}
            onPress={() => navigation.navigate('Result', { entryId: item.id })}
            accessibilityLabel={item.title}
            contentStyle={styles.row}
          >
            <View
              style={[
                styles.sticker,
                { backgroundColor: familyColors[item.family] },
              ]}
            >
              <AppText variant="label" color={palette.ink}>
                {item.outputs.length}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {item.title}
              </AppText>
              <AppText variant="mono" color="textMuted">
                {formatWhen(item.createdAt)} ·{' '}
                {formatBytes(item.outputs.reduce((s, f) => s + f.size, 0))}
              </AppText>
            </View>
            <Icon name="chevronRight" size={18} color={t.colors.textMuted} />
          </BrutalPressable>
        )}
      />
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  separator: { height: 10 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  sticker: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
});
