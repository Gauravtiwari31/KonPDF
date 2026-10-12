import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  appError,
  appErrorByCode,
  FriendlyError,
  toFriendlyError,
} from '../api/errors';
import { connectDrive } from '../features/drive/backup';
import { backupRequested } from '../features/drive/driveSlice';
import { useDriveAvailable } from '../features/drive/useDriveAvailable';
import { useLang } from '../hooks/useLang';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';
import { ErrorCard } from './ErrorCard';
import { AppText, BrutalBox, Button, Icon, useToast } from './ui';

/**
 * The Result screen's Google Drive part: "Save to Google Drive" (connecting
 * the account first if needed), then how the upload went. Shows nothing on
 * phones without Google Play services.
 */
export function DriveSave({
  entryId,
  style,
}: {
  entryId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const lang = useLang();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const available = useDriveAvailable();
  const { account, needsReconnect, folder } = useAppSelector(s => s.drive);
  const backup = useAppSelector(s => s.drive.backups[entryId]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  if (!available) {
    return null;
  }

  const save = async () => {
    setError(null);
    if (!account || needsReconnect) {
      setConnecting(true);
      try {
        if (!(await dispatch(connectDrive()))) {
          return;
        }
        if (!account) {
          toast({
            message: 'Connected. New results now back up to Drive too.',
            tone: 'success',
          });
        }
      } catch (e) {
        setError(toFriendlyError(e, lang));
        return;
      } finally {
        setConnecting(false);
      }
    }
    dispatch(backupRequested([entryId]));
  };

  const open = () => {
    const files = backup?.files ?? [];
    const link =
      files.length === 1 ? files[0].link : folder?.link ?? files[0]?.link;
    if (link) {
      Linking.openURL(link).catch(() => setError(appError('NO_APP', lang)));
    }
  };

  const failure =
    error ??
    (backup?.status === 'failed' && backup.error
      ? appErrorByCode(backup.error, lang)
      : null);

  let body: React.ReactNode;
  if (backup?.status === 'done') {
    body = (
      <BrutalBox offset={3} color={palette.mint} contentStyle={styles.row}>
        <Icon name="cloud" size={20} color={palette.ink} />
        <AppText variant="bodyStrong" color={palette.ink} style={styles.flex}>
          Saved in Google Drive
        </AppText>
        <Pressable
          onPress={open}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open in Google Drive"
          style={styles.action}
        >
          <Icon name="open" size={16} color={palette.ink} />
          <AppText variant="label" uppercase color={palette.ink}>
            Open
          </AppText>
        </Pressable>
      </BrutalBox>
    );
  } else if (backup?.status === 'queued' || backup?.status === 'uploading') {
    body = (
      <View
        style={[styles.row, styles.waiting, { borderColor: t.colors.line }]}
      >
        <ActivityIndicator color={t.colors.text} />
        <AppText variant="bodyStrong" style={styles.flex}>
          Saving to Google Drive…
        </AppText>
      </View>
    );
  } else {
    body = (
      <Button
        title={
          backup?.status === 'failed'
            ? 'Try Google Drive again'
            : 'Save to Google Drive'
        }
        icon="cloud"
        variant="outline"
        onPress={save}
        loading={connecting}
      />
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {body}
      {failure ? <ErrorCard error={failure} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  waiting: { borderWidth: 2, borderRadius: 12, borderStyle: 'dashed' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
});
