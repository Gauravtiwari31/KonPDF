import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * KonPDF's icon set (DoAll's, extended): chunky 24×24 strokes with round caps to match the
 * heavy outlines used across the UI. Each icon is a list of SVG path strings;
 * paths prefixed with "fill:" are filled instead of stroked.
 */
const ICONS = {
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  checks: ['M2 12.5l4.5 4.5L15 8.5', 'M10.5 16l1 1L21 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  trash: [
    'M4 7h16',
    'M10 11v6',
    'M14 11v6',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M9 7V4h6v3',
  ],
  edit: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  calendar: [
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    'M3 10h18',
    'M8 3v4',
    'M16 3v4',
  ],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  flag: ['M5 21V4', 'M5 4h12l-2.5 4 2.5 4H5'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  sliders: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  ],
  eyeOff: [
    'M3 3l18 18',
    'M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2',
    'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  logout: [
    'M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
  sun: [
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  auto: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'fill:M12 3a9 9 0 0 1 0 18z'],
  tag: [
    'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z',
    'fill:M7.5 6a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  ],
  sparkle: [
    'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
    'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  ],
  alert: ['M12 4l9.5 16h-19z', 'M12 10v4', 'M12 17.2v.3'],
  inbox: ['M3 13l3-8h12l3 8', 'M3 13v6h18v-6', 'M3 13h5l1 3h6l1-3h5'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  lock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  note: ['M6 3h12v18H6z', 'M9.5 8h5', 'M9.5 12h5', 'M9.5 16h3'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  repeat: [
    'M17 2l3 3-3 3',
    'M4 11V9a4 4 0 0 1 4-4h12',
    'M7 22l-3-3 3-3',
    'M20 13v2a4 4 0 0 1-4 4H4',
  ],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  cloud: ['M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18z'],
  // KonPDF tools
  file: ['M6 3h8l5 5v13H6z', 'M14 3v5h5'],
  image: [
    'M4 5h16v14H4z',
    'M4 16l5-5 4 4 2-2 5 5',
    'fill:M15.5 7.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  ],
  pdf: ['M6 3h8l5 5v13H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'],
  doc: ['M6 3h8l5 5v13H6z', 'M14 3v5h5', 'M9 12h6', 'M9 15h6', 'M9 18h4'],
  sheet: ['M4 4h16v16H4z', 'M4 9.5h16', 'M4 15h16', 'M10 4v16'],
  slides: ['M3 4h18v12H3z', 'M12 16v4', 'M8 20h8', 'M8 9h8', 'M8 12h5'],
  convert: ['M4 9h14', 'M14 5l4 4-4 4', 'M20 15H6', 'M10 11l-4 4 4 4'],
  resize: ['M14 4h6v6', 'M20 4l-7 7', 'M10 20H4v-6', 'M4 20l7-7'],
  compress: ['M4 10h6V4', 'M10 10L3 3', 'M20 14h-6v6', 'M14 14l7 7'],
  wand: [
    'M4 20L15 9',
    'M13 7l4 4',
    'M17 3v3',
    'M15.5 4.5h3',
    'M20 9v2',
    'M19 10h2',
    'M8 3v2',
    'M7 4h2',
  ],
  crop: ['M6 2v14a2 2 0 0 0 2 2h14', 'M2 6h14a2 2 0 0 1 2 2v14'],
  rotate: ['M4 11a8 8 0 1 1 2.3 5.7', 'M4 18v-7h7'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  scissors: [
    'M6 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M6 14a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M8.5 8.5L20 19',
    'M8.5 15.5L20 5',
  ],
  droplet: ['M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z'],
  hash: ['M5 9h15', 'M4 15h15', 'M10 3L8 21', 'M16 3l-2 18'],
  unlock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2'],
  info: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v6', 'M12 7.5v.3'],
  share: [
    'M18 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M6 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M18 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M8.6 13.5l6.8 4',
    'M15.4 6.5l-6.8 4',
  ],
  open: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  save: ['M5 4h11l3 3v13H5z', 'M8 4v5h7V4', 'M8 20v-6h8v6'],
  chat: ['M4 5h16v11H9l-5 4z', 'M8 9.5h8', 'M8 12.5h5'],
  send: ['M4 12L20 4l-6 16-3-7z', 'M11 13l9-9'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4', 'M12 8v4l3 2'],
  // A cog (not a sun): eight teeth around a hub.
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  globe: [
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
    'M3 12h18',
    'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  ],
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICONS[name].map(d =>
        d.startsWith('fill:') ? (
          <Path key={d} d={d.slice(5)} fill={color} />
        ) : (
          <Path
            key={d}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
