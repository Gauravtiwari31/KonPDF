/** Line icons on a 24 × 24 grid, drawn with the current text colour. */
const PATHS = {
  convert: 'M4 8h13l-4-4M20 16H7l4 4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 15h7M9 18h4',
  sheet: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  slides: 'M3 4h18v12H3zM12 16v4M8 20h8',
  resize: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  wand: 'M5 19L15 9M14 4v2M19 9h2M18 5l1.5-1.5M16.5 6.5l1 1M9 4l.5 1.5M19 14l1.5.5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  compress: 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5',
  scissors: 'M6 6a2.5 2.5 0 1 0 0 .01M6 18a2.5 2.5 0 1 0 0 .01M8 7.5L20 18M8 16.5L20 6',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  chat: 'M4 5h16v11H9l-5 4z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  phone: 'M7 2h10v20H7zM11 18h2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  send: 'M4 12l16-8-6 16-2-6z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
