import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { MAX_FILES } from '../config';
import { useLang } from '../hooks/useLang';
import { files, LocalFile } from '../services/files';
import { palette, useTheme } from '../theme';
import { FileRow } from './FileRow';
import { AppText, BrutalPressable, Icon } from './ui';

/**
 * The file list of a tool screen: a big "choose files" target while empty,
 * then the picked files with remove buttons and "Add more".
 */
export function FilePicker({
  files: picked,
  onChange,
  accept,
  multiple = true,
  onError,
}: {
  files: LocalFile[];
  onChange: (next: LocalFile[]) => void;
  accept: readonly string[];
  multiple?: boolean;
  onError: (error: FriendlyError) => void;
}) {
  const t = useTheme();
  const lang = useLang();
  const [picking, setPicking] = useState(false);

  const pick = async () => {
    setPicking(true);
    try {
      const more = await files.pick([...accept], multiple);
      if (more.length) {
        const next = multiple ? [...picked, ...more] : more.slice(0, 1);
        onChange(next.slice(0, MAX_FILES));
      }
    } catch (e) {
      onError(toFriendlyError(e, lang));
    } finally {
      setPicking(false);
    }
  };

  if (picked.length === 0) {
    return (
      <BrutalPressable
        onPress={pick}
        disabled={picking}
        accessibilityLabel={multiple ? 'Choose files' : 'Choose a file'}
        testID="pick-files"
        contentStyle={styles.empty}
      >
        <View style={[styles.plus, { backgroundColor: t.colors.highlight }]}>
          <Icon name="upload" size={26} color={palette.ink} />
        </View>
        <AppText variant="subheading">
          {multiple ? 'Choose files' : 'Choose a file'}
        </AppText>
        <AppText variant="caption" color="textMuted" align="center">
          Up to 50 MB each{multiple ? `, ${MAX_FILES} at a time` : ''}. You can
          also share files to KonPDF from any app.
        </AppText>
      </BrutalPressable>
    );
  }

  return (
    <View style={styles.list}>
      {picked.map((file, i) => (
        <FileRow
          key={`${file.path}-${i}`}
          file={file}
          onRemove={() => onChange(picked.filter((_, j) => j !== i))}
        />
      ))}
      {multiple && picked.length < MAX_FILES ? (
        <AppText
          variant="label"
          uppercase
          color={t.colors.primary}
          onPress={pick}
          style={styles.more}
        >
          + Add more
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  plus: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  list: { gap: 10 },
  more: { alignSelf: 'flex-start', paddingVertical: 6 },
});
