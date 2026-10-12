import { toFriendlyError } from '../../api/errors';
import { drive, DriveItem } from '../../services/drive';
import { FileActionError } from '../../services/files';
import type { AppDispatch, RootState } from '../../store';
import {
  backupDone,
  backupFailed,
  backupStarted,
  driveConnected,
  driveDisconnected,
  folderFound,
  queueFailed,
  reconnectNeeded,
} from './driveSlice';

type GetState = () => RootState;

/**
 * Opens Google's account picker and permission screen and connects that
 * account's Drive. Reconnecting (after access ended) keeps the same account.
 * False if the person backed out; Drive problems are thrown for an ErrorCard.
 */
export const connectDrive =
  () =>
  async (dispatch: AppDispatch, getState: GetState): Promise<boolean> => {
    const previous = getState().drive.account;
    const token = await drive.authorize(previous?.email ?? '', true);
    if (!token) {
      return false;
    }
    const account = await drive.account(token);
    const folder = await drive.folder(token);
    dispatch(driveConnected({ account, folder }));
    return true;
  };

/** Gives up KonPDF's access to the Drive. Files already there stay there. */
export const disconnectDrive =
  () =>
  async (dispatch: AppDispatch, getState: GetState): Promise<void> => {
    const account = getState().drive.account;
    if (account) {
      try {
        await drive.revoke(account.email);
      } catch {
        // Offline or already removed: forget the account here regardless.
        // Connecting again shows Google's account picker either way.
      }
    }
    dispatch(driveDisconnected());
  };

/**
 * Drive calls for one account, without asking the person anything: the
 * access token is fetched once, and fetched afresh once if Drive turns it
 * down (tokens last about an hour).
 */
function session(email: string) {
  let token: string | null = null;
  const fresh = async () => {
    const next = await drive.authorize(email, false);
    if (!next) {
      throw new FileActionError('drive_signed_out', '');
    }
    return next;
  };
  return async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
    token = token ?? (await fresh());
    try {
      return await fn(token);
    } catch (e) {
      if (!(e instanceof FileActionError) || e.code !== 'drive_auth') {
        throw e;
      }
      await drive.clearToken(token);
      token = await fresh();
      return fn(token);
    }
  };
}

/** Problems that stop every other queued backup too: no point trying each. */
const STOPS_THE_QUEUE = new Set([
  'DRIVE_SIGNED_OUT',
  'DRIVE_UNREACHABLE',
  'DRIVE_FULL',
  'DRIVE_BUSY',
  'DRIVE_NOT_SET_UP',
  'DRIVE_UNAVAILABLE',
]);

let working = false;

/**
 * Uploads queued results one at a time, oldest first, until none are left.
 * Runs in the background (store/listeners.ts); screens follow along through
 * each entry's backup status.
 */
export async function runQueue(dispatch: AppDispatch, getState: GetState) {
  if (working) {
    return;
  }
  working = true;
  try {
    let call: ReturnType<typeof session> | null = null;
    let folder: DriveItem | null = null;
    for (;;) {
      const { drive: state, history } = getState();
      // History is newest first.
      const next = [...history.entries]
        .reverse()
        .find(e => state.backups[e.id]?.status === 'queued');
      if (!next || !state.account) {
        return;
      }
      dispatch(backupStarted(next.id));
      try {
        call = call ?? session(state.account.email);
        if (!folder) {
          folder = await call(t => checkedFolder(t, state.folder));
          if (folder.id !== state.folder?.id) {
            dispatch(folderFound(folder));
          }
        }
        const target = folder;
        const files: DriveItem[] = [];
        for (const file of next.outputs) {
          files.push(
            await call(t =>
              drive.upload(t, file, target.id, {
                title: next.title,
                entryId: next.id,
              }),
            ),
          );
        }
        dispatch(backupDone({ id: next.id, files, at: Date.now() }));
      } catch (e) {
        const error = toFriendlyError(e, 'en').code;
        dispatch(backupFailed({ id: next.id, error }));
        if (error === 'DRIVE_SIGNED_OUT') {
          dispatch(reconnectNeeded());
        }
        if (STOPS_THE_QUEUE.has(error)) {
          dispatch(queueFailed(error));
          return;
        }
      }
    }
  } finally {
    working = false;
  }
}

/** The saved folder if it is still there (not deleted or in the bin), else KonPDF's folder found or made again. */
async function checkedFolder(
  token: string,
  saved: DriveItem | null,
): Promise<DriveItem> {
  if (saved && (await drive.folderExists(token, saved.id))) {
    return saved;
  }
  return drive.folder(token);
}
