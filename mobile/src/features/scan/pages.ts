import type { LocalFile } from '../../services/files';
import { scan } from '../../services/scan';

/** Pages read in one go: enough for a long letter, kind to the phone. */
export const MAX_READ_PAGES = 30;
/** The standard reader wants small print to be at least ~16 px tall. */
export const STANDARD_MAX_SIDE = 2400;

export const isPdf = (f: LocalFile) =>
  f.mime === 'application/pdf' || /\.pdf$/i.test(f.name);

/**
 * Every page to read as an upright JPEG no bigger than `maxSide`: pictures
 * are copied upright, PDFs are drawn page by page. Stops at MAX_READ_PAGES.
 */
export async function preparePages(
  inputs: LocalFile[],
  maxSide: number,
  onPage?: (done: number) => void,
): Promise<{ pages: LocalFile[]; skipped: number }> {
  const pages: LocalFile[] = [];
  let skipped = 0;
  for (const input of inputs) {
    if (isPdf(input)) {
      const count = await scan.pdfPageCount(input);
      for (let i = 0; i < count; i++) {
        if (pages.length >= MAX_READ_PAGES) {
          skipped += count - i;
          break;
        }
        pages.push(await scan.renderPdfPage(input, i, maxSide));
        onPage?.(pages.length);
      }
    } else if (pages.length < MAX_READ_PAGES) {
      pages.push(await scan.scaleImage(input, maxSide));
      onPage?.(pages.length);
    } else {
      skipped += 1;
    }
  }
  return { pages, skipped };
}

/** One text from all pages; page markers only when there is more than one. */
export function joinPages(texts: string[]): string {
  if (texts.length === 1) {
    return texts[0].trim();
  }
  return texts
    .map((text, i) => `— Page ${i + 1} —\n${text.trim()}`)
    .join('\n\n')
    .trim();
}

/** "Letter.pdf" → "Letter"; scans and pictures keep their names too. */
export const baseName = (inputs: LocalFile[]) =>
  (inputs[0]?.name ?? 'Text').replace(/\.[^.]+$/, '').replace(/ - page \d+$/, '') || 'Text';
