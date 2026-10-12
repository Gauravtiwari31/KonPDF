import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { ServerButton } from '../components/ServerSettings';
import {
  AppText,
  BrutalBox,
  BrutalPressable,
  Button,
  Chip,
  Icon,
  Screen,
  SectionLabel,
  Segmented,
  useConfirm,
} from '../components/ui';
import { APP_VERSION } from '../config';
import { historyCleared } from '../features/history/historySlice';
import {
  setLanguage,
  setQuality,
  setThemeMode,
  ThemeMode,
} from '../features/preferences/preferencesSlice';
import { deviceLang, LANGUAGES, LangPreference } from '../i18n/languages';
import type { ScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useTheme } from '../theme';

const QUALITY_PRESETS = [
  { value: 95, label: 'Best' },
  { value: 88, label: 'High' },
  { value: 80, label: 'Balanced' },
  { value: 65, label: 'Smallest' },
];

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const prefs = useAppSelector(state => state.preferences);
  const historyCount = useAppSelector(state => state.history.entries.length);
  const drive = useAppSelector(state => state.drive);
  const phoneLang = LANGUAGES.find(l => l.code === deviceLang())?.label;

  const clearHistory = async () => {
    if (
      await confirm({
        title: 'Clear history?',
        message: 'Your results will be removed from this phone.',
        confirmLabel: 'Clear',
        destructive: true,
      })
    ) {
      dispatch(historyCleared());
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="KonPDF" title="Settings" />

        <SectionLabel>Theme</SectionLabel>
        <Segmented<ThemeMode>
          value={prefs.themeMode}
          onChange={mode => dispatch(setThemeMode(mode))}
          options={[
            { value: 'system', label: 'System', icon: 'auto' },
            { value: 'light', label: 'Light', icon: 'sun' },
            { value: 'dark', label: 'Dark', icon: 'moon' },
          ]}
        />

        <SectionLabel style={styles.section}>NW and messages language</SectionLabel>
        <View style={styles.chips}>
          <Chip
            label={`Auto (${phoneLang})`}
            icon="globe"
            selected={prefs.language === 'auto'}
            onPress={() => dispatch(setLanguage('auto'))}
          />
          {LANGUAGES.map(l => (
            <Chip
              key={l.code}
              label={l.label}
              selected={prefs.language === l.code}
              onPress={() => dispatch(setLanguage(l.code as LangPreference))}
            />
          ))}
        </View>
        <AppText variant="caption" color="textMuted" style={styles.hint}>
          NW also replies in the language you write to it in.
        </AppText>

        <SectionLabel style={styles.section}>Default image quality</SectionLabel>
        <View style={styles.chips}>
          {QUALITY_PRESETS.map(q => (
            <Chip
              key={q.value}
              label={q.label}
              selected={prefs.quality === q.value}
              onPress={() => dispatch(setQuality(q.value))}
            />
          ))}
        </View>

        <SectionLabel style={styles.section}>Converter engine</SectionLabel>
        <View style={styles.row}>
          <ServerButton />
        </View>

        <SectionLabel style={styles.section}>Google Drive backup</SectionLabel>
        <BrutalPressable
          offset={3}
          onPress={() => navigation.navigate('Drive')}
          accessibilityLabel="Google Drive backup"
          contentStyle={styles.devRow}
        >
          <Icon name="cloud" size={22} color={t.colors.text} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {drive.account ? `On · ${drive.account.email}` : 'Off · optional'}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {!drive.account
                ? 'Sign in with Google to keep your files in your own Drive'
                : drive.needsReconnect
                ? 'Paused: reconnect to keep backing up'
                : drive.autoBackup
                ? 'New results are backed up automatically'
                : 'Results go to Drive when you choose'}
            </AppText>
          </View>
          <Icon name="chevronRight" size={20} color={t.colors.text} />
        </BrutalPressable>

        <SectionLabel style={styles.section}>Developer Mode</SectionLabel>
        <BrutalPressable
          offset={3}
          onPress={() => navigation.navigate('DeveloperMode')}
          accessibilityLabel="Developer Mode"
          contentStyle={styles.devRow}
        >
          <Icon name="chip" size={22} color={t.colors.text} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">
              {prefs.developerMode ? 'On' : 'Off'} · AI reader
            </AppText>
            <AppText variant="caption" color="textMuted">
              Read tables and messy pages with an AI that runs on your phone
            </AppText>
          </View>
          <Icon name="chevronRight" size={20} color={t.colors.text} />
        </BrutalPressable>

        <SectionLabel style={styles.section}>Privacy</SectionLabel>
        <BrutalBox offset={3} contentStyle={styles.card}>
          <AppText>
            Scanning and reading text happen on this phone. Files are sent to
            the converter only to process them, and are deleted from it after
            30 minutes. History stays on this phone, and goes to your own
            Google Drive only if you connect it. No KonPDF account, no
            tracking.
          </AppText>
        </BrutalBox>
        <Button
          title={`Clear history (${historyCount})`}
          variant="outline"
          size="md"
          icon="trash"
          iconPosition="left"
          onPress={clearHistory}
          disabled={historyCount === 0}
          style={styles.spaced}
        />

        <AppText variant="mono" color="textFaint" align="center" style={styles.section}>
          KonPDF {APP_VERSION}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { marginTop: 8 },
  row: { flexDirection: 'row' },
  card: { padding: 14 },
  spaced: { marginTop: 14 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  flex: { flex: 1 },
});
