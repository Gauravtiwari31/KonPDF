import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Developer Mode's model files: what the phone can run, and a resumable,
 * checksum-verified download into the app's private storage. Implemented in
 * android/app/src/main/java/com/konpdf/model/ModelModule.kt.
 */
export interface Spec extends TurboModule {
  /** JSON DeviceInfo (features/devmode/device.ts). */
  deviceInfo(): Promise<string>;
  /** Starts (or resumes) downloading one file; progress via downloadStatus. */
  startDownload(
    url: string,
    fileName: string,
    sha256: string,
    size: number,
    wifiOnly: boolean,
  ): Promise<void>;
  /** JSON DownloadStatus for one file. */
  downloadStatus(fileName: string): Promise<string>;
  /** Stops a running download; what is downloaded so far is kept. */
  pauseDownload(fileName: string): Promise<void>;
  /** Absolute path of a finished, verified file, or "". */
  modelPath(fileName: string): Promise<string>;
  /** Removes every model file and partial download. */
  deleteModels(): Promise<void>;
  /** Keeps the screen on (long downloads, reading pages). */
  keepScreenOn(on: boolean): Promise<void>;
}

/** Null where the native code doesn't exist (tests). */
export default TurboModuleRegistry.get<Spec>('KonModel');
