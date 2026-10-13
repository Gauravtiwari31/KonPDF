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

/** Display name for a format code: "jpg" → "JPG", "md" → "Markdown". */
export function formatLabel(format: string): string {
  const special: Record<string, string> = { md: 'Markdown', txt: 'Text', jpeg: 'JPG' };
  return special[format] ?? format.toUpperCase();
}

/** "12.5" → 12.5; empty or not a positive number → undefined. */
export const num = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};
