import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { extensionOf } from '../api/engine';
import { familyOfFormat } from '../features/tools/catalog';
import type { LocalFile } from '../services/files';
import { familyColors, palette, useTheme } from '../theme';
import { formatBytes, formatLabel } from '../utils/format';
import { AppText, BrutalBox, Icon, IconName } from './ui';

const ICON_FOR: Record<string, IconName> = {
  image: 'image',
  pdf: 'pdf',
  document: 'doc',
  sheet: 'sheet',
};

/** A picked file or a result: thumbnail (images) or a format sticker, name, size. */
export function FileRow({
  file,
  detail,
  onRemove,
  onPress,
  right,
}: {
  file: LocalFile;
  /** Extra mono line, e.g. "2.4 MB → 48 KB". Defaults to format · size. */
  detail?: string;
  onRemove?: () => void;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const format = extensionOf(file.name);
  const family = familyOfFormat(format);
  const isImage = file.mime.startsWith('image/') && !file.mime.includes('svg');

  const body = (
    <BrutalBox offset={3} contentStyle={styles.row}>
      {isImage ? (
        <Image
          source={{ uri: file.uri }}
          style={[styles.thumb, { borderColor: t.colors.line }]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.sticker,
            { backgroundColor: familyColors[family], borderColor: t.colors.line },
          ]}
        >
          <Icon name={ICON_FOR[family] ?? 'file'} size={20} color={palette.ink} />
        </View>
      )}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {file.name}
        </AppText>
        <AppText variant="mono" color="textMuted" numberOfLines={1}>
          {detail ?? `${formatLabel(format || '?')} · ${formatBytes(file.size)}`}
        </AppText>
      </View>
      {right}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${file.name}`}
        >
          <Icon name="x" size={20} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </BrutalBox>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={file.name}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, borderWidth: 2 },
  sticker: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
