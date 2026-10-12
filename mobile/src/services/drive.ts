import NativeDrive from '../native/NativeDrive';
import { FileActionError, LocalFile } from './files';

/**
 * Google Drive, for the optional backup. KonPDF only ever holds the
 * drive.file scope, so everything here sees just the files KonPDF made:
 * its own folder and what it uploaded. Problems come out as FileActionError
 * with a "drive_*" code, which toFriendlyError (api/errors.ts) puts in words.
 */

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** The folder's name when KonPDF makes it; people may rename or move it. */
export const FOLDER_NAME = 'KonPDF';
/** Marks KonPDF's folder, so it is found again even after a rename or move. */
const FOLDER_TAG = { key: 'konpdf', value: 'folder' };
const REQUEST_TIMEOUT_MS = 30_000;

export interface DriveAccount {
  email: string;
  name: string;
}

/** A file or folder in Drive, with the address that opens it. */
export interface DriveItem {
  id: string;
  link: string;
}

export const fileLink = (id: string) =>
  `https://drive.google.com/file/d/${id}/view`;
export const folderLink = (id: string) =>
  `https://drive.google.com/drive/folders/${id}`;

function native() {
  if (!NativeDrive) {
    throw new FileActionError(
      'drive_unavailable',
      'Google Drive is not available here',
    );
  }
  return NativeDrive;
}

/** Drive's refusal (HTTP status and its error body) as a drive_* code. */
export function driveCode(status: number, body: string): string {
  if (status === 401) {
    // The access token ran out: get a fresh one and try again.
    return 'drive_auth';
  }
  if (status === 404) {
    return 'drive_not_found';
  }
  if (/storageQuotaExceeded/.test(body)) {
    return 'drive_full';
  }
  if (/accessNotConfigured|SERVICE_DISABLED/.test(body)) {
    // The Drive API isn't turned on for KonPDF's Google Cloud project.
    return 'drive_not_configured';
  }
  if (status === 429 || status >= 500 || /rateLimitExceeded/i.test(body)) {
    return 'drive_busy';
  }
  return 'drive_failed';
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FileActionError) {
      throw error;
    }
    const e = error as { code?: string; message?: string };
    const code = e.code ?? 'drive_failed';
    const message = e.message ?? '';
    if (code.startsWith('drive_http_')) {
      throw new FileActionError(
        driveCode(Number(code.slice(11)), message),
        message,
      );
    }
    throw new FileActionError(code, message);
  }
}

/** One call to Drive's JSON API. */
async function request<T>(
  token: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new FileActionError(
      'drive_network',
      'Google Drive could not be reached',
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new FileActionError(driveCode(response.status, text), text);
  }
  return JSON.parse(text) as T;
}

type Item = { id: string; webViewLink?: string; trashed?: boolean };

const toFolder = (item: Item): DriveItem => ({
  id: item.id,
  link: item.webViewLink || folderLink(item.id),
});

export const drive = {
  isAvailable: async () => {
    try {
      return NativeDrive ? await NativeDrive.isAvailable() : false;
    } catch {
      return false;
    }
  },

  /** An access token; "" if the person backed out of Google's screens. */
  authorize: (email: string, interactive: boolean) =>
    call(() => native().authorize(email, interactive)),

  clearToken: async (token: string) => {
    try {
      await native().clearToken(token);
    } catch {
      // Nothing cached is fine.
    }
  },

  revoke: (email: string) => call(() => native().revoke(email)),

  /** Who is connected (Drive's own record, so no extra scope is needed). */
  account: async (token: string): Promise<DriveAccount> => {
    const { user } = await request<{
      user?: { displayName?: string; emailAddress?: string };
    }>(token, 'about?fields=user(displayName,emailAddress)');
    if (!user?.emailAddress) {
      throw new FileActionError(
        'drive_failed',
        'Drive did not say who is signed in',
      );
    }
    return {
      email: user.emailAddress,
      name: user.displayName || user.emailAddress,
    };
  },

  /** KonPDF's folder in this Drive, made the first time it is needed. */
  folder: async (token: string): Promise<DriveItem> => {
    const q =
      `appProperties has { key='${FOLDER_TAG.key}' and value='${FOLDER_TAG.value}' }` +
      ` and mimeType='${FOLDER_MIME}' and trashed=false`;
    const found = await request<{ files?: Item[] }>(
      token,
      `files?q=${encodeURIComponent(
        q,
      )}&orderBy=createdTime&pageSize=1&fields=files(id,webViewLink)`,
    );
    if (found.files?.length) {
      return toFolder(found.files[0]);
    }
    const made = await request<Item>(token, 'files?fields=id,webViewLink', {
      name: FOLDER_NAME,
      mimeType: FOLDER_MIME,
      appProperties: { [FOLDER_TAG.key]: FOLDER_TAG.value },
    });
    return toFolder(made);
  },

  /** True if the folder is still there and not in the bin. */
  folderExists: async (token: string, id: string): Promise<boolean> => {
    try {
      const item = await request<Item>(
        token,
        `files/${encodeURIComponent(id)}?fields=id,trashed`,
      );
      return !item.trashed;
    } catch (e) {
      if (e instanceof FileActionError && e.code === 'drive_not_found') {
        return false;
      }
      throw e;
    }
  },

  /** Uploads one file into the folder. `entryId` ties it to its History entry. */
  upload: async (
    token: string,
    file: LocalFile,
    folderId: string,
    meta: { title: string; entryId: string },
  ): Promise<DriveItem> => {
    const metadata = {
      name: file.name,
      parents: [folderId],
      description: `${meta.title} · made with KonPDF`,
      appProperties: { konpdfEntry: meta.entryId },
    };
    const json = await call(() =>
      native().upload(token, file.path, file.mime, JSON.stringify(metadata)),
    );
    const made = JSON.parse(json) as Item;
    return { id: made.id, link: made.webViewLink || fileLink(made.id) };
  },
};
