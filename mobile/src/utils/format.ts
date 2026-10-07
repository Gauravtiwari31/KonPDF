/** 2400000 → "2.3 MB", 48213 → "47 KB", 900 → "900 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '–';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Relative size change, e.g. -98 for 2.4 MB → 48 KB. Null when the input size is unknown. */
export function sizeChangePercent(
  before: number,
  after: number,
): number | null {
  if (!before) {
    return null;
  }
  return Math.round(((after - before) / before) * 100);
}

/** "−98 %" / "+12 %" / "same size". */
export function formatChange(percent: number | null): string {
  if (percent === null) {
    return '';
  }
  if (percent === 0) {
    return 'same size';
  }
  return `${percent < 0 ? '−' : '+'}${Math.abs(percent)} %`;
}

/** Display name for a format code: "jpg" → "JPG", "md" → "Markdown". */
export function formatLabel(format: string): string {
  const special: Record<string, string> = {
    md: 'Markdown',
    txt: 'Text',
    jpeg: 'JPG',
  };
  return special[format] ?? format.toUpperCase();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "12:04" today, "Mon 12:04" this week, otherwise "3 Oct". */
export function formatWhen(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
  if (date.toDateString() === new Date(now).toDateString()) {
    return time;
  }
  if ((now - timestamp) / 86_400_000 < 6) {
    return `${WEEKDAYS[date.getDay()]} ${time}`;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
