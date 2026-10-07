import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import { FileRow } from '../components/FileRow';
import {
  AppText,
  BrutalBox,
  Button,
  Icon,
  IconButton,
  Screen,
  SectionLabel,
  useToast,
} from '../components/ui';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import { files, LocalFile } from '../services/files';
import { useAppSelector } from '../store/hooks';
import { familyColors, palette, useTheme } from '../theme';
import { formatBytes, formatChange, sizeChangePercent } from '../utils/format';

/** A finished job: what changed, and open / share / save for each file. */
export function ResultScreen({ navigation, route }: ScreenProps<'Result'>) {
  const t = useTheme();
  const lang = useLang();
  const toast = useToast();
  const entry = useAppSelector(state =>
    state.history.entries.find(e => e.id === route.params.entryId),
  );
  const [error, setError] = useState<FriendlyError | null>(null);

  if (!entry) {
    return (
      <Screen style={styles.missing}>
        <AppText variant="heading">This result was cleared.</AppText>
        <Button title="Back home" onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  const outBytes = entry.outputs.reduce((s, f) => s + f.size, 0);
  const change = sizeChangePercent(entry.inputBytes, outBytes);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null);
    try {
      const ok = await fn();
      if (done && ok !== false) {
        toast({ message: done, tone: 'success' });
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    }
  };

  const fileActions = (file: LocalFile) => (
    <View style={styles.rowActions}>
      <Pressable
        onPress={() => act(() => files.open(file))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Open ${file.name}`}
      >
        <Icon name="open" size={20} color={t.colors.text} />
      </Pressable>
      <Pressable
        onPress={() => act(() => files.share([file]))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Share ${file.name}`}
      >
        <Icon name="share" size={20} color={t.colors.text} />
      </Pressable>
      <Pressable
        onPress={() => act(() => files.save(file), 'Saved')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Save ${file.name}`}
      >
        <Icon name="save" size={20} color={t.colors.text} />
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.bar}>
          <IconButton
            icon="x"
            label="Close"
            onPress={() => navigation.popToTop()}
          />
        </View>

        <BrutalBox
          color={familyColors[entry.family]}
          contentStyle={styles.hero}
        >
          <View style={styles.doneBadge}>
            <Icon name="check" size={22} color={palette.ink} strokeWidth={3} />
          </View>
          <AppText variant="label" uppercase color={palette.inkSoft}>
            Done
          </AppText>
          <AppText variant="title" color={palette.ink}>
            {entry.title}
          </AppText>
          <AppText variant="mono" color={palette.ink}>
            {entry.inputCount} in → {entry.outputs.length} out ·{' '}
            {formatBytes(entry.inputBytes)} → {formatBytes(outBytes)}
            {change !== null ? `  (${formatChange(change)})` : ''}
          </AppText>
        </BrutalBox>

        {entry.notes.map(note => (
          <View key={note} style={[styles.note, { borderColor: t.colors.line }]}>
            <Icon name="info" size={18} color={t.colors.text} />
            <AppText style={styles.flex}>{note}</AppText>
          </View>
        ))}

        {error ? <ErrorCard error={error} style={styles.section} /> : null}

        <View style={styles.section}>
          <SectionLabel>
            {entry.outputs.length === 1 ? 'Your file' : `Your ${entry.outputs.length} files`}
          </SectionLabel>
          <View style={styles.list}>
            {entry.outputs.map(file => (
              <FileRow
                key={file.path}
                file={file}
                onPress={() => act(() => files.open(file))}
                right={fileActions(file)}
              />
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.actions]}>
          <Button
            title={entry.outputs.length > 1 ? 'Share all' : 'Share'}
            icon="share"
            onPress={() => act(() => files.share(entry.outputs))}
          />
          {entry.outputs.length === 1 ? (
            <Button
              title="Save to phone"
              icon="save"
              variant="outline"
              onPress={() => act(() => files.save(entry.outputs[0]), 'Saved')}
            />
          ) : null}
          <Button
            title="Do more with it"
            icon="sparkle"
            variant="dark"
            onPress={() => navigation.navigate('Nw', { files: entry.outputs })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  missing: { padding: 20, gap: 16, justifyContent: 'center' },
  bar: { flexDirection: 'row', marginBottom: 16 },
  hero: { padding: 18, gap: 6 },
  doneBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.volt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 14,
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  flex: { flex: 1 },
  section: { marginTop: 24 },
  list: { gap: 10 },
  rowActions: { flexDirection: 'row', gap: 14, marginLeft: 4 },
  actions: { gap: 12 },
});
