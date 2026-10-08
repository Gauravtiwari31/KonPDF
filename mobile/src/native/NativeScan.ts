import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * The document scanner and the on-phone text reader (Google ML Kit), plus the
 * page plumbing around them. Implemented in
 * android/app/src/main/java/com/konpdf/scan/ScanModule.kt.
 *
 * Files cross as JSON strings of LocalFile (services/files.ts).
 */
export interface Spec extends TurboModule {
  /** False on phones without Google Play services (the scanner needs them). */
  isScannerAvailable(): Promise<boolean>;
  /**
   * Opens the scanner. Resolves "" if the person backed out, otherwise
   * JSON { pages: LocalFile[], pdf: LocalFile | null }.
   */
  scanDocument(pageLimit: number, allowGallery: boolean): Promise<string>;
  /** Reads one image. script: "latin" | "devanagari". JSON OcrPage. */
  recognizeText(path: string, script: string): Promise<string>;
  pdfPageCount(path: string): Promise<number>;
  /** One PDF page as a JPEG whose long side is `maxSide` pixels. */
  renderPdfPage(path: string, index: number, maxSide: number): Promise<string>;
  /** Upright JPEG copy no larger than `maxSide` (photo rotation applied). */
  scaleImage(path: string, maxSide: number): Promise<string>;
  /** Pages (images) into one PDF, on the phone. */
  makePdf(paths: ReadonlyArray<string>, fileName: string): Promise<string>;
  /** Writes text to a file in the cache (for sharing or converting). */
  writeText(text: string, fileName: string): Promise<string>;
  copyText(text: string): Promise<void>;
}

/** Null where the native code doesn't exist (tests). */
export default TurboModuleRegistry.get<Spec>('KonScan');
