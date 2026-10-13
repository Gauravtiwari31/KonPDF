import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { extensionOf } from '../api/engine';
import { familyOfFormat } from '../features/tools/catalog';
import type { LocalFile } from '../services/files';
import { familyColors, palette } from '../theme';
import { AppText, Icon } from './ui';

/**
 * A file as a small sticker: format colour, short name, and an × when it can
 * be removed. Used in NW's chat, where whole file rows take too much room.
 */
export function FileChip({
  file,
  onRemove,
}: {
  file: LocalFile;
  onRemove?: () => void;
}) {
  const family = familyOfFormat(extensionOf(file.name));
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: family ? familyColors[family] : palette.card },
      ]}
      accessibilityLabel={file.name}
    >
      <Icon name="file" size={14} color={palette.ink} />
      <AppText
        variant="caption"
        color={palette.ink}
        numberOfLines={1}
        style={styles.name}
      >
        {file.name}
      </AppText>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${file.name}`}
        >
          <Icon name="x" size={14} color={palette.ink} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
    maxWidth: 210,
  },
  name: { flexShrink: 1 },
});
