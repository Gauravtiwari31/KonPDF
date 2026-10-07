import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ServerButton } from '../components/ServerSettings';
import {
  Accent,
  AppText,
  BrutalBox,
  Button,
  Icon,
  IconName,
  Logo,
  Screen,
} from '../components/ui';
import { familyColors, palette, useTheme } from '../theme';

/** A loose pile of format stickers that previews what the app does. */
function FormatCollage() {
  const t = useTheme();
  const sticker = (
    label: string,
    icon: IconName,
    color: string,
    style: object,
  ) => (
    <BrutalBox
      color={color}
      style={[styles.note, style]}
      contentStyle={styles.noteFace}
    >
      <Icon name={icon} size={18} color={palette.ink} />
      <AppText variant="bodyStrong" color={palette.ink}>
        {label}
      </AppText>
    </BrutalBox>
  );
  return (
    <View
      style={styles.collage}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {sticker('HEIC → JPG', 'image', familyColors.image, styles.note1)}
      {sticker('Word → PDF', 'pdf', familyColors.pdf, styles.note2)}
      {sticker('Photo < 50 KB', 'resize', familyColors.resize, styles.note3)}
      {sticker('XLSX → CSV', 'sheet', familyColors.sheet, styles.note4)}
      <View style={[styles.spark, { borderColor: t.colors.line }]}>
        <AppText variant="label" color={palette.ink}>
          NW
        </AppText>
      </View>
    </View>
  );
}

/** First run only. */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Logo size={34} />
          <ServerButton />
        </View>

        <View style={styles.hero}>
          <AppText variant="display" style={styles.headline}>
            Convert
          </AppText>
          <View style={styles.allRow}>
            <BrutalBox
              color={palette.volt}
              radius={16}
              style={styles.allSticker}
              contentStyle={styles.allFace}
            >
              <AppText color={palette.ink}>
                <Accent size={64} style={styles.allText}>
                  anything.
                </Accent>
              </AppText>
            </BrutalBox>
          </View>
          <AppText variant="body" color="textMuted" style={styles.lede}>
            Images, PDFs, documents and sheets in any direction. Resize photos
            to the exact KB a form wants, clean up scans, and ask NW in your own
            language.
          </AppText>
        </View>

        <FormatCollage />

        <View style={styles.actions}>
          <Button
            title="Let's go"
            icon="arrowRight"
            onPress={onDone}
            testID="welcome-start"
          />
          <AppText variant="caption" color="textMuted" align="center">
            No account needed. Files are deleted from the converter after 30
            minutes.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hero: { marginTop: 36 },
  headline: { fontSize: 60, lineHeight: 62, letterSpacing: -2.4 },
  allRow: { flexDirection: 'row', marginTop: 4 },
  allSticker: { transform: [{ rotate: '-3deg' }] },
  allFace: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 },
  allText: { lineHeight: 72 },
  lede: { marginTop: 22, maxWidth: 330, fontSize: 16, lineHeight: 23 },
  collage: { height: 230, marginTop: 28, marginBottom: 12 },
  note: { position: 'absolute' },
  note1: { top: 0, left: 0, transform: [{ rotate: '-6deg' }] },
  note2: { top: 50, right: 0, transform: [{ rotate: '4deg' }] },
  note3: { top: 112, left: 18, transform: [{ rotate: '-2deg' }] },
  note4: { top: 168, right: 24, transform: [{ rotate: '3deg' }] },
  noteFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  spark: {
    position: 'absolute',
    top: 4,
    right: 70,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: palette.aqua,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 12, marginTop: 'auto', paddingTop: 16 },
});
