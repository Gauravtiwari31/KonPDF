import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  appError,
  appErrorByCode,
  FriendlyError,
  toFriendlyError,
} from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Checkbox,
  Icon,
  Screen,
  SectionLabel,
  useConfirm,
  useToast,
} from '../components/ui';
import { connectDrive, disconnectDrive } from '../features/drive/backup';
import {
  autoBackupSet,
  backupCounts,
  backupRequested,
} from '../features/drive/driveSlice';
import { useDriveAvailable } from '../features/drive/useDriveAvailable';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Optional Google Drive backup: connect a Google account, choose whether new
 * results go to Drive by themselves, back up what is already on the phone,
 * and disconnect again.
 */
export function DriveScreen(_: ScreenProps<'Drive'>) {
  const t = useTheme();
  const lang = useLang();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const toast = useToast();
  const available = useDriveAvailable();
  const state = useAppSelector(s => s.drive);
  const entries = useAppSelector(s => s.history.entries);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const { account, folder, autoBackup, needsReconnect } = state;
  const counts = backupCounts(state, entries);

  const connect = async () => {
    setError(null);
    setBusy('connect');
    try {
      if (await dispatch(connectDrive())) {
        toast({ message: 'Google Drive connected', tone: 'success' });
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Google Drive?',
      message:
        'Files already in your Drive stay there. KonPDF stops backing up and gives up its access to your Drive.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (ok) {
      setError(null);
      setBusy('disconnect');
      await dispatch(disconnectDrive());
      setBusy(null);
    }
  };

  const openFolder = () => {
    if (folder) {
      Linking.openURL(folder.link).catch(() =>
        setError(appError('NO_APP', lang)),
      );
    }
  };

  const toggleAuto = () => dispatch(autoBackupSet(!autoBackup));

  const intro = (
    <BrutalBox contentStyle={styles.card}>
      <View style={styles.head}>
        <View style={[styles.badge, { borderColor: t.colors.line }]}>
          <Icon name="cloud" size={22} color={palette.ink} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">Back up to your Google Drive</AppText>
          <AppText variant="mono" color="textMuted">
            Optional · off
          </AppText>
        </View>
      </View>
      <AppText color="textMuted">
        Sign in with your Google account and the PDFs, scans and results you
        make are kept in a KonPDF folder in your own Drive: safe if you lose or
        change your phone, and there on your computer too.
      </AppText>
      <Button
        title="Connect Google Drive"
        icon="cloud"
        onPress={connect}
        loading={busy === 'connect'}
        disabled={available === null}
      />
    </BrutalBox>
  );

  const connected = account ? (
    <>
      {needsReconnect ? (
        <BrutalBox
          color={palette.rose}
          contentStyle={styles.card}
          style={styles.spaced}
        >
          <AppText variant="subheading" color={palette.ink}>
            Drive access has ended
          </AppText>
          <AppText color={palette.ink}>
            Google needs you to allow KonPDF again: the access was removed or
            ran out. Backups are paused until then.
          </AppText>
          <Button
            title="Reconnect"
            icon="refresh"
            variant="dark"
            onPress={connect}
            loading={busy === 'connect'}
          />
        </BrutalBox>
      ) : null}

      <BrutalBox contentStyle={styles.card}>
        <View style={styles.head}>
          <View style={[styles.badge, { borderColor: t.colors.line }]}>
            <AppText variant="subheading" color={palette.ink}>
              {account.name.trim().charAt(0).toUpperCase() || 'G'}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="subheading" numberOfLines={1}>
              {account.name}
            </AppText>
            <AppText variant="mono" color="textMuted" numberOfLines={1}>
              {account.email}
            </AppText>
          </View>
        </View>
        <AppText color="textMuted">
          Backing up to KonPDF’s folder in this Drive.
        </AppText>
        <Button
          title="Open in Drive"
          icon="open"
          variant="outline"
          size="md"
          onPress={openFolder}
          disabled={!folder}
        />
      </BrutalBox>

      <Pressable
        onPress={toggleAuto}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: autoBackup }}
        style={[styles.section, styles.toggleRow]}
      >
        <View style={styles.flex}>
          <AppText variant="bodyStrong">
            Back up new results automatically
          </AppText>
          <AppText variant="caption" color="textMuted">
            Every scan and result goes to Drive as soon as it’s made. Off: only
            when you tap “Save to Google Drive”.
          </AppText>
        </View>
        <Checkbox
          checked={autoBackup}
          onToggle={toggleAuto}
          label="Back up automatically"
        />
      </Pressable>

      <SectionLabel style={styles.section}>History on this phone</SectionLabel>
      <BrutalBox offset={3} contentStyle={styles.card}>
        <AppText variant="bodyStrong">
          {entries.length
            ? `${counts.done} of ${plural(entries.length, 'result')} in Drive`
            : 'Nothing in History yet'}
        </AppText>
        {counts.active ? (
          <AppText variant="mono" color="textMuted">
            Backing up {plural(counts.active, 'result')}…
          </AppText>
        ) : null}
        {counts.notYet.length && !needsReconnect ? (
          <Button
            title={`Back up ${plural(counts.notYet.length, 'more result')}`}
            icon="upload"
            variant="outline"
            size="md"
            onPress={() => dispatch(backupRequested(counts.notYet))}
          />
        ) : null}
      </BrutalBox>

      {counts.problem && !needsReconnect && !counts.active ? (
        <ErrorCard
          error={appErrorByCode(counts.problem, lang)}
          style={styles.section}
        />
      ) : null}

      <Button
        title="Disconnect"
        icon="logout"
        variant="outline"
        size="md"
        onPress={disconnect}
        loading={busy === 'disconnect'}
        style={styles.section}
      />
    </>
  ) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="Settings" title="Google Drive" />

        {available === false ? (
          <BrutalBox offset={3} contentStyle={styles.card}>
            <AppText variant="subheading">Not on this phone</AppText>
            <AppText color="textMuted">
              Google Drive backup needs Google Play services, which this phone
              doesn’t have. Everything else in KonPDF works fully, and you can
              still share or save any file.
            </AppText>
          </BrutalBox>
        ) : (
          connected ?? intro
        )}

        {error ? <ErrorCard error={error} style={styles.section} /> : null}

        <SectionLabel style={styles.section}>Good to know</SectionLabel>
        <View style={styles.facts}>
          <AppText color="textMuted">
            • Optional. KonPDF works fully without it, and there is no KonPDF
            account.
          </AppText>
          <AppText color="textMuted">
            • KonPDF can see only the files it saves to your Drive, never
            anything else in it.
          </AppText>
          <AppText color="textMuted">
            • Files go straight from this phone to your Drive. The converter
            never sees them.
          </AppText>
          <AppText color="textMuted">
            • Uses your Google Drive storage (every Google account comes with 15
            GB free).
          </AppText>
          <AppText color="textMuted">
            • Disconnect any time. What is already in your Drive stays yours.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  spaced: { marginBottom: 16 },
  card: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: palette.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  facts: { gap: 8 },
});
