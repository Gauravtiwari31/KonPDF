import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  AI_READER,
  AI_READER_BYTES,
  checkDevice,
} from '../features/devmode/model';
import { getDeviceInfo } from '../features/devmode/useAiReaderModel';
import type { RootStackParamList } from '../navigation/types';
import { STORAGE_KEYS, storage } from '../services/storage';
import { palette, useTheme } from '../theme';
import { formatBytes } from '../utils/format';
import { AppText, BrutalBox, Button, Icon } from './ui';

/**
 * Shown once, the first time someone reaches the tabs (new installs and
 * updates alike): what Developer Mode is, what it costs, and whether this
 * phone can run it. Nothing is downloaded unless they go on to set it up.
 */
export function DevModeIntro() {
  const t = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [visible, setVisible] = useState(false);
  const [fits, setFits] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await storage.get<boolean>(STORAGE_KEYS.devModeIntro)) {
        return;
      }
      const info = await getDeviceInfo();
      if (cancelled) {
        return;
      }
      setFits(info ? checkDevice(info).ok : null);
      // A moment after the tabs appear, so it doesn't fight the first frame.
      setTimeout(() => !cancelled && setVisible(true), 700);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = (setUp: boolean) => {
    storage.set(STORAGE_KEYS.devModeIntro, true);
    setVisible(false);
    if (setUp) {
      navigation.navigate('DeveloperMode');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={() => close(false)}>
        <Pressable onPress={() => undefined} style={styles.center}>
          <BrutalBox
            color={t.colors.surface}
            radius={t.radius.lg}
            contentStyle={styles.card}
          >
            <View style={[styles.badge, { borderColor: t.colors.line }]}>
              <Icon name="chip" size={26} color={palette.ink} />
            </View>
            <AppText variant="label" uppercase color="textMuted">
              New in KonPDF
            </AppText>
            <AppText variant="heading">Meet Developer Mode</AppText>
            <AppText color="textMuted" style={styles.gap}>
              The Scan tab reads text from your pages with Google’s reader:
              instant, nothing to download.
            </AppText>
            <AppText color="textMuted" style={styles.gap}>
              Developer Mode adds an AI reader, {AI_READER.name}, that runs
              fully on your phone. It’s better with tables and messy pages, but
              slower (about 20–90 seconds a page) and needs a one-time{' '}
              {formatBytes(AI_READER_BYTES)} download.
            </AppText>
            {fits !== null ? (
              <View
                style={[
                  styles.fit,
                  { borderColor: t.colors.line, backgroundColor: fits ? palette.mint : palette.paperDeep },
                ]}
              >
                <Icon name={fits ? 'check' : 'info'} size={18} color={palette.ink} />
                <AppText variant="caption" color={palette.ink} style={styles.flex}>
                  {fits
                    ? 'Your phone can run it.'
                    : 'Your phone can’t run the AI reader, but scanning and the standard reader work fully.'}
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" color="textFaint" style={styles.gap}>
              You can turn it on any time in Settings → Developer Mode.
            </AppText>
            <View style={styles.actions}>
              <Button
                title="Maybe later"
                variant="outline"
                size="md"
                onPress={() => close(false)}
                style={styles.flex}
              />
              <Button
                title={fits === false ? 'See why' : 'Set it up'}
                variant="dark"
                size="md"
                onPress={() => close(true)}
                style={styles.flex}
              />
            </View>
          </BrutalBox>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  center: { width: '100%' },
  card: { padding: 22, gap: 4 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: palette.volt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gap: { marginTop: 8 },
  fit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderWidth: 2,
    borderRadius: 12,
  },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
