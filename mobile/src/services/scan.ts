import NativeScan from '../native/NativeScan';
import { FileActionError, LocalFile } from './files';

/** One line of text the reader found, with where it sits on the page (pixels). */
export interface OcrLine {
  text: string;
  /** [left, top, right, bottom] */
  box: number[];
  confidence?: number;
}

export interface OcrBlock {
  text: string;
  box: number[];
  lines: OcrLine[];
}

/** What the standard reader found on one page picture. */
export interface OcrPage {
  text: string;
  width: number;
  height: number;
  blocks: OcrBlock[];
}

export interface ScanResult {
  pages: LocalFile[];
  pdf: LocalFile | null;
}

/** Scripts the standard reader knows (Devanagari also reads Latin letters). */
export type Script = 'latin' | 'devanagari';

function native() {
  if (!NativeScan) {
    throw new FileActionError('unavailable', 'Scanning is not available here');
  }
  return NativeScan;
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FileActionError) {
      throw error;
    }
    const e = error as { code?: string; message?: string };
    throw new FileActionError(e.code ?? 'failed', e.message ?? '');
  }
}

const file = (json: string) => JSON.parse(json) as LocalFile;

export const scan = {
  isAvailable: async () => {
    try {
      return NativeScan ? await NativeScan.isScannerAvailable() : false;
    } catch {
      return false;
    }
  },

  /** Null if the person backed out of the scanner. */
  document: (pageLimit = 30, allowGallery = true) =>
    call(async () => {
      const json = await native().scanDocument(pageLimit, allowGallery);
      return json ? (JSON.parse(json) as ScanResult) : null;
    }),

  readText: (page: LocalFile, script: Script) =>
    call(
      async () =>
        JSON.parse(await native().recognizeText(page.path, script)) as OcrPage,
    ),

  pdfPageCount: (pdf: LocalFile) => call(() => native().pdfPageCount(pdf.path)),

  renderPdfPage: (pdf: LocalFile, index: number, maxSide: number) =>
    call(async () => file(await native().renderPdfPage(pdf.path, index, maxSide))),

  scaleImage: (image: LocalFile, maxSide: number) =>
    call(async () => file(await native().scaleImage(image.path, maxSide))),

  makePdf: (pages: LocalFile[], fileName: string) =>
    call(async () =>
      file(await native().makePdf(pages.map(p => p.path), fileName)),
    ),

  writeText: (text: string, fileName: string) =>
    call(async () => file(await native().writeText(text, fileName))),

  copy: (text: string) => call(() => native().copyText(text)),
};

/** Lines of a page in reading order, for the searchable-PDF layer. */
export const ocrLines = (page: OcrPage) =>
  page.blocks.flatMap(b => b.lines).filter(l => l.text.trim() && l.box.length === 4);
