import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Icon,
  Screen,
  SectionLabel,
  TextField,
  useConfirm,
} from '../components/ui';
import { useLang } from '../hooks/useLang';
import { useLocalResult } from '../hooks/useLocalResult';
import type { ScreenProps } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { scan } from '../services/scan';
import { palette, useTheme } from '../theme';
import { formatBytes } from '../utils/format';

const defaultName = (pdf?: LocalFile | null) =>
  pdf?.name.replace(/\.pdf$/i, '') ??
  `Scan ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}`;

/**
 * Pages just scanned (or picked as photos): put them in order, drop or add
 * pages, then save one PDF, read the text, or carry on in another tool.
 */
export function ScanResultScreen({ navigation, route }: ScreenProps<'ScanResult'>) {
  const t = useTheme();
  const lang = useLang();
  const confirm = useConfirm();
  const finish = useLocalResult();
  const original = route.params.pages;
  const [pages, setPages] = useState<LocalFile[]>(original);
  const [name, setName] = useState(defaultName(route.params.pdf));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  // The scanner's own PDF is used as long as the pages are exactly as scanned.
  const untouched = useMemo(
    () =>
      pages.length === original.length && pages.every((p, i) => p.path === original[i].path),
    [pages, original],
  );
  const totalBytes = pages.reduce((s, p) => s + p.size, 0);

  const move = (index: number, by: number) => {
    const next = [...pages];
    const [page] = next.splice(index, 1);
    next.splice(index + by, 0, page);
    setPages(next);
  };

  const remove = async (index: number) => {
    if (pages.length === 1) {
      return;
    }
    if (await confirm({ title: `Remove page ${index + 1}?`, confirmLabel: 'Remove', destructive: true })) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const addPages = async () => {
    setError(null);
    try {
      const more = await scan.document();
      if (more?.pages.length) {
        setPages([...pages, ...more.pages]);
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    }
  };

  /** One PDF of the pages as they are now. */
  const buildPdf = async (): Promise<LocalFile> => {
    const fileName = `${(name.trim() || defaultName(null)).replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
    if (untouched && route.params.pdf?.name === fileName) {
      return route.params.pdf;
    }
    return scan.makePdf(pages, fileName);
  };

  const act = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(toFriendlyError(e, lang));
    } finally {
      setBusy(null);
    }
  };

  const savePdf = () =>
    act('save', async () => {
      const pdf = await buildPdf();
      finish(pages, [pdf], {
        title: `Scan · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`,
        family: 'pdf',
        kind: 'scan',
      });
    });

  const compress = () =>
    act('compress', async () => {
      const pdf = await buildPdf();
      navigation.navigate('PdfTools', { tool: 'compress', files: [pdf] });
    });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={`${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · ${formatBytes(totalBytes)}`}
          title="Your scan"
        />

        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          returnKeyType="done"
        />

        <SectionLabel style={styles.section}>Pages</SectionLabel>
        <View style={styles.grid}>
          {pages.map((page, i) => (
            <View key={page.path} style={styles.cell}>
              <BrutalBox offset={3} contentStyle={styles.thumbFace}>
                <Image source={{ uri: page.uri }} style={styles.thumb} resizeMode="cover" />
                <View style={[styles.number, { borderColor: t.colors.line }]}>
                  <AppText variant="label" color={palette.ink}>
                    {i + 1}
                  </AppText>
                </View>
              </BrutalBox>
              <View style={styles.pageActions}>
                <Pressable
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Move page ${i + 1} earlier`}
                  style={i === 0 && styles.disabled}
                >
                  <Icon name="chevronLeft" size={20} color={t.colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => remove(i)}
                  disabled={pages.length === 1}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove page ${i + 1}`}
                  style={pages.length === 1 && styles.disabled}
                >
                  <Icon name="trash" size={18} color={t.colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => move(i, 1)}
                  disabled={i === pages.length - 1}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Move page ${i + 1} later`}
                  style={i === pages.length - 1 && styles.disabled}
                >
                  <Icon name="chevronRight" size={20} color={t.colors.text} />
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable
            onPress={addPages}
            accessibilityRole="button"
            accessibilityLabel="Scan more pages"
            style={[styles.cell, styles.add, { borderColor: t.colors.line }]}
          >
            <Icon name="plus" size={26} color={t.colors.text} />
            <AppText variant="caption">Add pages</AppText>
          </Pressable>
        </View>

        {error ? <ErrorCard error={error} style={styles.section} /> : null}

        <View style={[styles.section, styles.actions]}>
          <Button
            title="Save as PDF"
            icon="save"
            onPress={savePdf}
            loading={busy === 'save'}
            disabled={!!busy}
          />
          <Button
            title="Read the text"
            icon="text"
            variant="dark"
            onPress={() => navigation.navigate('ReadText', { files: pages })}
            disabled={!!busy}
          />
          <View style={styles.row}>
            <Button
              title="Compress"
              icon="compress"
              variant="outline"
              size="md"
              onPress={compress}
              loading={busy === 'compress'}
              disabled={!!busy}
              style={styles.flex}
            />
            <Button
              title="Enhance"
              icon="wand"
              variant="outline"
              size="md"
              onPress={() => navigation.navigate('Enhance', { files: pages })}
              disabled={!!busy}
              style={styles.flex}
            />
          </View>
          <Button
            title="Convert pages"
            icon="convert"
            variant="outline"
            size="md"
            onPress={() => navigation.navigate('Convert', { toolId: 'any', files: pages })}
            disabled={!!busy}
          />
        </View>
        <AppText variant="caption" color="textFaint" align="center" style={styles.section}>
          Saving the PDF happens on your phone. Compress, Enhance and Convert use
          the converter.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Three columns: a third of the row minus the gaps.
  cell: { width: '30%', gap: 6 },
  thumbFace: { overflow: 'hidden', aspectRatio: 0.72 },
  thumb: { width: '100%', height: '100%' },
  number: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: palette.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  disabled: { opacity: 0.3 },
  add: {
    aspectRatio: 0.72,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actions: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
