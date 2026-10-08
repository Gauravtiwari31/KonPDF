import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Checkbox,
  Icon,
  IconName,
  Screen,
  SectionLabel,
  useConfirm,
} from '../components/ui';
import {
  AI_READER,
  AI_READER_BYTES,
  checkDevice,
  CheckLevel,
  DeviceInfo,
} from '../features/devmode/model';
import { getDeviceInfo, useAiReaderModel } from '../features/devmode/useAiReaderModel';
import { setDeveloperMode, setWifiOnly } from '../features/preferences/preferencesSlice';
import type { ScreenProps } from '../navigation/types';
import { release } from '../services/aiReader';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';
import { formatBytes } from '../utils/format';

const LEVEL_ICON: Record<CheckLevel, IconName> = { ok: 'check', warn: 'alert', fail: 'x' };
const LEVEL_COLOR: Record<CheckLevel, string> = {
  ok: palette.mint,
  warn: palette.volt,
  fail: palette.rose,
};

/** Download problems, in words. */
const DOWNLOAD_ERRORS: Record<string, string> = {
  needs_wifi: 'Waiting for Wi-Fi. Connect to Wi-Fi, or turn off “Wi-Fi only” below.',
  no_space: 'Not enough free space on this phone. Free up some space and try again.',
  network: 'The connection dropped. Tap Resume: it continues where it stopped.',
  corrupt: 'The download arrived damaged and was removed. Please download it again.',
  failed: 'Something went wrong with the download. Please try again.',
};

/**
 * Developer Mode: the optional AI reader. Shows whether this phone can run
 * it, downloads and checks the model, and removes it again.
 */
export function DeveloperModeScreen(_: ScreenProps<'DeveloperMode'>) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { developerMode, wifiOnly } = useAppSelector(s => s.preferences);
  const { status, download, pause, remove } = useAiReaderModel();
  const [device, setDevice] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    getDeviceInfo().then(setDevice);
  }, []);

  const ready = status.phase === 'ready';
  const check = device ? checkDevice(device, ready) : null;
  const canRun = check?.ok ?? false;
  const percent = Math.floor((status.bytes / (status.total || AI_READER_BYTES)) * 100);

  const toggle = () => dispatch(setDeveloperMode(!developerMode));

  const deleteModel = async () => {
    if (
      await confirm({
        title: 'Delete the AI reader?',
        message: `This frees ${formatBytes(AI_READER_BYTES)}. You can download it again any time.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
    ) {
      await release();
      await remove();
    }
  };

  const startDownload = async () => {
    if (
      !device?.onUnmeteredNetwork &&
      !wifiOnly &&
      !(await confirm({
        title: 'Download on mobile data?',
        message: `The AI reader is ${formatBytes(AI_READER_BYTES)}. That can use a lot of your data plan.`,
        confirmLabel: 'Download',
      }))
    ) {
      return;
    }
    download();
  };

  const modelAction = () => {
    switch (status.phase) {
      case 'checking':
        return null;
      case 'none':
        return (
          <Button
            title={`Download (${formatBytes(AI_READER_BYTES)})`}
            icon="download"
            onPress={startDownload}
            disabled={!developerMode || !canRun}
          />
        );
      case 'downloading':
      case 'verifying':
        return (
          <View style={styles.gap}>
            <View style={[styles.track, { borderColor: t.colors.line }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${status.phase === 'verifying' ? 100 : percent}%`, backgroundColor: palette.violet },
                ]}
              />
            </View>
            <AppText variant="mono" color="textMuted">
              {status.phase === 'verifying'
                ? 'Checking the files…'
                : `${formatBytes(status.bytes)} of ${formatBytes(status.total)} · ${percent} %`}
            </AppText>
            {status.phase === 'downloading' ? (
              <Button title="Pause" icon="pause" variant="outline" size="md" onPress={pause} />
            ) : null}
          </View>
        );
      case 'paused':
      case 'failed':
        return (
          <View style={styles.gap}>
            {status.phase === 'failed' ? (
              <AppText color="textMuted">
                {DOWNLOAD_ERRORS[status.error ?? 'failed'] ?? DOWNLOAD_ERRORS.failed}
              </AppText>
            ) : (
              <AppText variant="mono" color="textMuted">
                Paused at {formatBytes(status.bytes)} of {formatBytes(status.total)}
              </AppText>
            )}
            <View style={styles.row}>
              <Button
                title={status.bytes > 0 ? 'Resume' : 'Try again'}
                icon="download"
                size="md"
                onPress={startDownload}
                disabled={!developerMode || !canRun}
                style={styles.flex}
              />
              <Button
                title="Delete"
                icon="trash"
                variant="outline"
                size="md"
                onPress={deleteModel}
                style={styles.flex}
              />
            </View>
          </View>
        );
      case 'ready':
        return (
          <View style={styles.gap}>
            <View style={styles.readyRow}>
              <View style={[styles.dot, { borderColor: t.colors.line }]}>
                <Icon name="check" size={16} color={palette.ink} strokeWidth={3} />
              </View>
              <AppText variant="bodyStrong" style={styles.flex}>
                Ready. Pick “AI reader” on the Read text screen.
              </AppText>
            </View>
            <Button
              title="Delete the model"
              icon="trash"
              variant="outline"
              size="md"
              onPress={deleteModel}
            />
          </View>
        );
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="Settings" title="Developer Mode" />

        <BrutalBox contentStyle={styles.toggleFace}>
          <Pressable
            onPress={toggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: developerMode }}
            style={styles.toggleRow}
          >
            <View style={styles.flex}>
              <AppText variant="subheading">Developer Mode</AppText>
              <AppText variant="caption" color="textMuted">
                Extra tools that run on this phone and need more from it.
              </AppText>
            </View>
            <Checkbox checked={developerMode} onToggle={toggle} label="Developer Mode" />
          </Pressable>
        </BrutalBox>

        <SectionLabel style={styles.section}>AI reader</SectionLabel>
        <BrutalBox contentStyle={styles.card}>
          <View style={styles.modelHead}>
            <View style={[styles.badge, { borderColor: t.colors.line }]}>
              <Icon name="chip" size={22} color={palette.ink} />
            </View>
            <View style={styles.flex}>
              <AppText variant="subheading">{AI_READER.name}</AppText>
              <AppText variant="mono" color="textMuted">
                {formatBytes(AI_READER_BYTES)} · {AI_READER.licence} · offline
              </AppText>
            </View>
          </View>
          <AppText color="textMuted">
            Reads text from photos and scans with a vision AI that runs fully on
            your phone. Better than the standard reader with tables, columns and
            messy or handwritten-looking pages; tables can become Excel sheets.
            Slower: about 20–90 seconds a page.
          </AppText>
          {!developerMode ? (
            <AppText variant="caption" color="textMuted">
              Turn on Developer Mode above to download it.
            </AppText>
          ) : null}
          {modelAction()}
        </BrutalBox>

        <Pressable
          onPress={() => dispatch(setWifiOnly(!wifiOnly))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: wifiOnly }}
          style={[styles.section, styles.toggleRow]}
        >
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Download on Wi-Fi only</AppText>
            <AppText variant="caption" color="textMuted">
              Waits for Wi-Fi so it doesn’t use your mobile data.
            </AppText>
          </View>
          <Checkbox checked={wifiOnly} onToggle={() => dispatch(setWifiOnly(!wifiOnly))} label="Wi-Fi only" />
        </Pressable>

        <SectionLabel style={styles.section}>This phone</SectionLabel>
        <BrutalBox offset={3} contentStyle={styles.card}>
          {device ? (
            <>
              <AppText variant="mono" color="textMuted">
                {device.model} · Android API {device.sdk}
              </AppText>
              {check?.checks.map(item => (
                <View key={item.id} style={styles.checkRow}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: t.colors.line, backgroundColor: LEVEL_COLOR[item.level] },
                    ]}
                  >
                    <Icon name={LEVEL_ICON[item.level]} size={14} color={palette.ink} strokeWidth={3} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{item.label}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {item.detail}
                    </AppText>
                  </View>
                </View>
              ))}
              <AppText variant="caption" color={canRun ? 'textMuted' : 'text'}>
                {canRun
                  ? 'This phone can run the AI reader.'
                  : 'This phone can’t run the AI reader. Scanning and the standard reader work fully.'}
              </AppText>
            </>
          ) : (
            <AppText color="textMuted">Checking this phone…</AppText>
          )}
        </BrutalBox>

        <SectionLabel style={styles.section}>Good to know</SectionLabel>
        <View style={styles.facts}>
          <AppText color="textMuted">
            • Your pages never leave the phone while it reads. No account, no key.
          </AppText>
          <AppText color="textMuted">
            • The model downloads once from Hugging Face (Qwen’s official files)
            and is checked before use.
          </AppText>
          <AppText color="textMuted">
            • While reading it uses about 2 GB of memory, freed a minute after.
          </AppText>
          <AppText color="textMuted">
            • AI reading can misread or invent a word. Check numbers and names.
          </AppText>
          <AppText variant="caption" color="textFaint" style={styles.gap}>
            Qwen3-VL by the Qwen team (Apache-2.0), run with llama.cpp (MIT) via
            llama.rn (MIT).
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  toggleFace: { padding: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  card: { padding: 16, gap: 12 },
  modelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: palette.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: { gap: 10 },
  track: { height: 16, borderWidth: 2, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%' },
  row: { flexDirection: 'row', gap: 12 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: palette.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  facts: { gap: 8 },
});
