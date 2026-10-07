import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ServerButton } from '../components/ServerSettings';
import { ToolTile } from '../components/ToolTile';
import {
  Accent,
  AppText,
  BrutalPressable,
  Icon,
  IconButton,
  Logo,
  Screen,
  SectionLabel,
} from '../components/ui';
import { SECTIONS, ToolDef } from '../features/tools/catalog';
import type { ScreenProps } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { familyColors, palette, useTheme } from '../theme';
import { formatBytes, formatWhen } from '../utils/format';

/** Home: Ask NW, every tool as a sticker tile, and the latest results. */
export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const t = useTheme();
  const recent = useAppSelector(state => state.history.entries.slice(0, 5));

  const open = (tool: ToolDef) => {
    if (tool.screen === 'Convert') {
      navigation.navigate('Convert', { toolId: tool.id });
    } else {
      navigation.navigate(tool.screen);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Logo size={32} />
          <View style={styles.topActions}>
            <IconButton
              icon="history"
              label="History"
              onPress={() => navigation.navigate('History')}
            />
            <IconButton
              icon="settings"
              label="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </View>

        <AppText variant="title" style={styles.headline}>
          Convert <Accent size={36}>anything.</Accent>
        </AppText>
        <AppText color="textMuted" style={styles.lede}>
          Images, PDFs, documents and sheets. Resize, enhance, or just tell NW
          what you need.
        </AppText>

        <BrutalPressable
          onPress={() => navigation.navigate('Nw')}
          color={familyColors.nw}
          accessibilityLabel="Ask NW, the assistant"
          testID="ask-nw"
          style={styles.askNw}
          contentStyle={styles.askFace}
        >
          <View style={[styles.nwBadge, { borderColor: palette.ink }]}>
            <AppText variant="label" color={palette.ink}>
              NW
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={palette.ink}>
              Ask NW
            </AppText>
            <AppText variant="caption" color={palette.inkSoft} numberOfLines={1}>
              “Make this photo under 50 KB” · “isko PDF bana do”
            </AppText>
          </View>
          <Icon name="arrowRight" size={20} color={palette.ink} />
        </BrutalPressable>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <SectionLabel>{section.title}</SectionLabel>
            <View style={styles.grid}>
              {section.tools.map(tool => (
                <ToolTile
                  key={tool.id}
                  tool={tool}
                  onPress={() => open(tool)}
                  style={styles.tile}
                />
              ))}
            </View>
          </View>
        ))}

        {recent.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel
              right={
                <AppText
                  variant="label"
                  uppercase
                  color={t.colors.primary}
                  onPress={() => navigation.navigate('History')}
                >
                  See all
                </AppText>
              }
            >
              Recent
            </SectionLabel>
            <View style={styles.recent}>
              {recent.map(entry => (
                <BrutalPressable
                  key={entry.id}
                  offset={3}
                  onPress={() =>
                    navigation.navigate('Result', { entryId: entry.id })
                  }
                  accessibilityLabel={entry.title}
                  contentStyle={styles.recentRow}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: familyColors[entry.family],
                        borderColor: t.colors.line,
                      },
                    ]}
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

        <View style={styles.footer}>
          <ServerButton />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: { flexDirection: 'row', gap: 10 },
  headline: { marginTop: 24 },
  lede: { marginTop: 8, maxWidth: 340 },
  askNw: { marginTop: 20 },
  askFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  nwBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  section: { marginTop: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two columns: half the row minus half the gap.
  tile: { width: '48%', flexGrow: 1 },
  recent: { gap: 10 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  footer: { marginTop: 28, alignItems: 'center' },
});
