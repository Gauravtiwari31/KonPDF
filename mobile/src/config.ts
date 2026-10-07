import { Platform } from 'react-native';
import { version } from '../package.json';
import { HOSTED_API_URL } from './env';
import { normalizeApiUrl } from './utils/url';

/** Set only in package.json; the Android build reads the same field. */
export const APP_VERSION: string = version;

/**
 * An engine running on your own computer, as seen from the Android emulator
 * (`10.0.2.2` is the emulator's alias for your computer's `localhost`).
 */
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });
export const LOCAL_API_URL = `http://${DEV_HOST}:8000/api`;

/**
 * Address the app uses until someone changes it in Settings: the hosted
 * engine when the build was given one (env.ts), otherwise the local one.
 */
export const DEFAULT_API_URL =
  (HOSTED_API_URL && normalizeApiUrl(HOSTED_API_URL)) || LOCAL_API_URL;

/** Quick calls (health, NW chat). Generous: a free host can take ~30 s to wake. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Uploads and conversions: big files on slow connections take a while. */
export const JOB_TIMEOUT_MS = 180_000;

/** Same limits as the engine's defaults, checked before uploading. */
export const MAX_FILE_MB = 50;
export const MAX_FILES = 20;
