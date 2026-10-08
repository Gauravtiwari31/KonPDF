import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import {
  Accent,
  AppText,
  BrutalPressable,
  Icon,
  IconButton,
  Logo,
  SectionLabel,
  Screen,
} from '../components/ui';
import { isAiReaderReady } from '../features/devmode/useAiReaderModel';
import { ACCEPT } from '../features/tools/catalog';
import { useLang } from '../hooks/useLang';
import type { TabProps } from '../navigation/types';
import { files } from '../services/files';
import { scan } from '../services/scan';
import { useAppSelector } from '../store/hooks';
import { familyColors, palette, useTheme } from '../theme';
import { formatBytes, formatWhen } from '../utils/format';

/**
 * The Scan tab: make a clean PDF from paper with the camera, turn photos of
 * pages into a document, or read the text on them. Scanning and reading
 * happen on the phone; nothing is sent anywhere until you convert.
 */
export function ScanScreen({ navigation }: TabProps<'Scan'>) {
  const t = useTheme();
  const lang = useLang();
  const developerMode = useAppSelector(s => s.preferences.developerMode);
  const recent = useAppSelector(s =>
    s.history.entries.filter(e => e.kind === 'scan' || e.kind === 'text').slice(0, 5),
  );
  const [available, setAvailable] = useState<boolean | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    scan.isAvailable().then(setAvailable);
  }, []);

  useFocusEffect(
    useCallback(() => {
      isAiReaderReady().then(setAiReady);
    }, []),
  );

  const startScan = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await scan.document();
      if (result && result.pages.length) {
        navigation.navigate('ScanResult', { pages: result.pages, pdf: result.pdf });
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const pickPages = async () => {
    setError(null);
    try {
      const picked = await files.pick([...ACCEPT.images], true);
      if (picked.length) {
        navigation.navigate('ScanResult', { pages: picked, pdf: null });
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Logo size={32} />
          <IconButton
            icon="settings"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <AppText variant="title" style={styles.headline}>
          Scan <Accent size={36}>paper.</Accent>
        </AppText>
        <AppText color="textMuted" style={styles.lede}>
          Point your camera at a page: edges, crop and clean-up are done for
          you. Then save it as a PDF or read its text.
        </AppText>

        <BrutalPressable
          onPress={available === false ? pickPages : startScan}
          disabled={busy}
          color={palette.volt}
          accessibilityLabel="Scan a document"
          testID="scan-document"
          style={styles.hero}
          contentStyle={styles.heroFace}
        >
          <View style={[styles.heroIcon, { borderColor: palette.ink }]}>
            <Icon name="camera" size={30} color={palette.ink} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading" color={palette.ink}>
              {available === false ? 'Photos to PDF' : 'Scan a document'}
            </AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {available === false
                ? 'Pick photos of your pages'
                : 'Many pages in one go · from the camera or gallery'}
            </AppText>
          </View>
          <Icon name="arrowRight" size={22} color={palette.ink} />
        </BrutalPressable>

        {available === false ? (
          <AppText variant="caption" color="textMuted" style={styles.note}>
            The camera scanner needs Google Play services, which this phone
            doesn’t have. Photos of your pages work just as well.
          </AppText>
        ) : null}

        {error ? <ErrorCard error={error} style={styles.section} /> : null}

        <View style={[styles.section, styles.grid]}>
          <BrutalPressable
            onPress={() => navigation.navigate('ReadText')}
            color={familyColors.document}
            accessibilityLabel="Read text from a photo or PDF"
            testID="read-text"
            stretch
            style={styles.tile}
            contentStyle={styles.tileFace}
          >
            <Icon name="text" size={26} color={palette.ink} />
            <AppText variant="bodyStrong" color={palette.ink}>
              Read text
            </AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              Copy it, or save as Word or a searchable PDF
            </AppText>
          </BrutalPressable>
          <BrutalPressable
            onPress={pickPages}
            color={familyColors.pdf}
            accessibilityLabel="Make a document from photos"
            stretch
            style={styles.tile}
            contentStyle={styles.tileFace}
          >
            <Icon name="image" size={26} color={palette.ink} />
            <AppText variant="bodyStrong" color={palette.ink}>
              Photos → pages
            </AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              Already took pictures? Make them a PDF
            </AppText>
          </BrutalPressable>
        </View>

        <BrutalPressable
          offset={3}
          onPress={() => navigation.navigate('DeveloperMode')}
          accessibilityLabel="Developer Mode"
          style={styles.section}
          contentStyle={styles.devRow}
        >
          <View
            style={[
              styles.devBadge,
              {
                borderColor: t.colors.line,
                backgroundColor: developerMode && aiReady ? palette.mint : t.colors.surfaceAlt,
              },
            ]}
          >
            <Icon name="chip" size={20} color={palette.ink} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">AI reader</AppText>
            <AppText variant="caption" color="textMuted">
              {!developerMode
                ? 'Off · turn on Developer Mode for tables and messy pages'
                : aiReady
                ? 'Ready · runs on your phone'
                : 'Developer Mode is on · download the model to use it'}
            </AppText>
          </View>
          <Icon name="chevronRight" size={20} color={t.colors.text} />
        </BrutalPressable>

        {recent.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Recent scans</SectionLabel>
            <View style={styles.recent}>
              {recent.map(entry => (
                <BrutalPressable
                  key={entry.id}
                  offset={3}
                  onPress={() => navigation.navigate('Result', { entryId: entry.id })}
                  accessibilityLabel={entry.title}
                  contentStyle={styles.recentRow}
                >
                  <Icon
                    name={entry.kind === 'text' ? 'text' : 'scan'}
                    size={18}
                    color={t.colors.text}
                  />
                  <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {entry.title}
                  </AppText>
                  <AppText variant="mono" color="textMuted">
                    {formatBytes(entry.outputs.reduce((s, f) => s + f.size, 0))}
                    {' · '}
                    {formatWhen(entry.createdAt)}
                  </AppText>
                </BrutalPressable>
              ))}
            </View>
          </View>
        ) : null}

        <AppText variant="caption" color="textFaint" align="center" style={styles.section}>
          Scanning and reading text happen on this phone.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headline: { marginTop: 24 },
  lede: { marginTop: 8, maxWidth: 340 },
  hero: { marginTop: 20 },
  heroFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  note: { marginTop: 10 },
  section: { marginTop: 24 },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  tileFace: { padding: 14, gap: 6 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  devBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recent: { gap: 10 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
});
