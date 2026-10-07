import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Android file plumbing KonPDF needs. Implemented in
 * android/app/src/main/java/com/konpdf/device/DeviceModule.kt.
 *
 * File lists come back as JSON strings of LocalFile[] (services/files.ts),
 * which keeps the native interface simple and stable.
 */
export interface Spec extends TurboModule {
  /** Android's file picker. Resolves "[]" if the person backed out. */
  pickFiles(
    mimeTypes: ReadonlyArray<string>,
    multiple: boolean,
  ): Promise<string>;
  /** Files shared to KonPDF from another app since the last call. */
  takeSharedFiles(): Promise<string>;
  /** Downloads a result into the app's cache; rejects with code "http_<status>" and the body. */
  downloadFile(
    url: string,
    fileName: string,
    headersJson: string,
  ): Promise<string>;
  /** Android's "Save to" screen. Resolves false if the person backed out. */
  saveFile(path: string, fileName: string, mimeType: string): Promise<boolean>;
  shareFiles(paths: ReadonlyArray<string>, mimeType: string): Promise<void>;
  openFile(path: string, mimeType: string): Promise<void>;
  /** Deletes one of KonPDF's own cached copies. */
  deleteFile(path: string): Promise<void>;
}

/** Null where the native code doesn't exist (tests). */
export default TurboModuleRegistry.get<Spec>('KonDevice');
