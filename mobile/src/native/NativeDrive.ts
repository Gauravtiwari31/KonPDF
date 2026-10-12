import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Optional Google Drive backup: Google's own sign-in and permission screens
 * (Play services), and uploads from the phone straight into the person's
 * Drive. Implemented in
 * android/app/src/main/java/com/konpdf/drive/DriveModule.kt.
 *
 * KonPDF asks for one scope, drive.file: it can see only the files it puts
 * in Drive itself, never the rest of someone's Drive.
 */
export interface Spec extends TurboModule {
  /** False on phones without Google Play services (sign-in needs them). */
  isAvailable(): Promise<boolean>;
  /**
   * An access token for the person's Drive. `email` picks the account; ""
   * opens Google's account picker. With `interactive`, Google's screens may
   * open and "" means the person backed out. Without it nothing is shown,
   * and it rejects with "drive_signed_out" if the person would have to be
   * asked again.
   */
  authorize(email: string, interactive: boolean): Promise<string>;
  /** Forgets a token Drive turned down, so the next authorize() gets a fresh one. */
  clearToken(token: string): Promise<void>;
  /** Withdraws KonPDF's access to this account's Drive (disconnect). */
  revoke(email: string): Promise<void>;
  /**
   * Uploads one file, streamed from disk. `metadataJson` is the Drive file
   * resource (name, parents...). Resolves JSON { id, webViewLink }; Drive's
   * refusals reject with "drive_http_<status>" and Drive's message body.
   */
  upload(
    token: string,
    path: string,
    mime: string,
    metadataJson: string,
  ): Promise<string>;
}

/** Null where the native code doesn't exist (tests). */
export default TurboModuleRegistry.get<Spec>('KonDrive');
