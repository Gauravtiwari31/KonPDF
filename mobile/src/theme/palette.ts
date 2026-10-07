/**
 * KonPDF palette — "Ink & Volt".
 *
 * The same neo-brutalist "paper & ink" system as DoAll, recoloured: cool
 * blue-white paper, indigo ink for text and outlines, an electric violet
 * accent and a volt-yellow highlight, plus sticker colours for each tool
 * family. Everything in the UI is derived from these values via the semantic
 * themes in themes.ts.
 */
export const palette = {
  paper: '#EEF0F8',
  paperDeep: '#DFE3F1',
  card: '#FBFCFF',
  ink: '#16163A',
  inkSoft: '#565A78',
  inkFaint: '#9094AE',

  night: '#0E0F22',
  nightCard: '#181A35',
  nightRaised: '#23264A',
  frost: '#E8EBFA',
  frostSoft: '#A6AACB',
  frostFaint: '#666A8E',

  violet: '#7357FF', // primary accent
  volt: '#FFE14D', // highlight
  coral: '#FF8F73', // images
  rose: '#FF6B81', // pdf
  sky: '#8EC5FF', // documents
  mint: '#7FE3A9', // sheets
  lavender: '#C8B6FF', // enhance
  aqua: '#5FE8D3', // NW
  danger: '#E8344E',
} as const;

/** Sticker colour for each tool family (chips, tiles). Text on them is always ink. */
export const familyColors = {
  image: palette.coral,
  pdf: palette.rose,
  document: palette.sky,
  sheet: palette.mint,
  resize: palette.volt,
  enhance: palette.lavender,
  nw: palette.aqua,
} as const;

export type Family = keyof typeof familyColors;
