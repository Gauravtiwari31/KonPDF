import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { ToolDef } from '../features/tools/catalog';
import { familyColors, palette } from '../theme';
import { AppText, BrutalPressable, Icon } from './ui';

/** Home grid tile: a sticker-coloured card that presses into its shadow. */
export function ToolTile({
  tool,
  onPress,
  style,
}: {
  tool: ToolDef;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BrutalPressable
      onPress={onPress}
      color={familyColors[tool.family]}
      accessibilityLabel={`${tool.title}. ${tool.subtitle}`}
      testID={`tool-${tool.id}`}
      style={style}
      contentStyle={styles.face}
    >
      <View style={styles.iconWrap}>
        <Icon name={tool.icon} size={22} color={palette.ink} />
      </View>
      <AppText variant="subheading" color={palette.ink} numberOfLines={1}>
        {tool.title}
      </AppText>
      <AppText variant="caption" color={palette.inkSoft} numberOfLines={2}>
        {tool.subtitle}
      </AppText>
    </BrutalPressable>
  );
}

const styles = StyleSheet.create({
  face: { padding: 14, gap: 4, minHeight: 124 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
