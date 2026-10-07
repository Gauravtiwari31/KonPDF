import { TextStyle } from 'react-native';

/**
 * Font files live in android/app/src/main/assets/fonts. On Android the family
 * name is the file name, and each weight is its own family (don't combine with
 * `fontWeight`, which would make Android fall back to a synthetic bold).
 */
export const fonts = {
  regular: 'BricolageGrotesque-Regular',
  medium: 'BricolageGrotesque-Medium',
  semibold: 'BricolageGrotesque-SemiBold',
  bold: 'BricolageGrotesque-Bold',
  black: 'BricolageGrotesque-ExtraBold',
  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoBold: 'IBMPlexMono-SemiBold',
  serifItalic: 'InstrumentSerif-Italic',
} as const;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'mono';

export const textVariants: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily: fonts.black,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.6,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.9,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  subheading: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  // Small uppercase mono used for section labels and metadata ("DUE TUE 14:00").
  label: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
  },
  mono: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
};
