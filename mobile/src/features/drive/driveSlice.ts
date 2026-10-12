import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { DriveAccount, DriveItem } from '../../services/drive';
import type { HistoryEntry } from '../history/historySlice';

/** Where one History entry stands with Google Drive. */
export interface Backup {
  status: 'queued' | 'uploading' | 'done' | 'failed';
  /** The result's files in Drive, in the order of its outputs. */
  files?: DriveItem[];
  at?: number;
  /** FriendlyError code (api/errors.ts) when it failed. */
  error?: string;
}

/**
 * Optional Google Drive backup. Off until someone connects their Google
 * account; persisted by the listener in store/listeners.ts.
 */
export interface DriveState {
  account: DriveAccount | null;
  /** KonPDF's folder in that Drive. */
  folder: DriveItem | null;
  /** Google wants to ask the person again (access removed or expired). */
  needsReconnect: boolean;
  /** Back up each new result as soon as it is made. */
  autoBackup: boolean;
  /** When automatic backup was turned on: results made since then are backed up. */
  autoSince: number | null;
  /** By History entry id. */
  backups: Record<string, Backup>;
}

export const initialDrive: DriveState = {
  account: null,
  folder: null,
  needsReconnect: false,
  autoBackup: false,
  autoSince: null,
  backups: {},
};

/** A backup that would never succeed by itself trying again. */
const HOPELESS = new Set(['FILE_GONE']);

const driveSlice = createSlice({
  name: 'drive',
  initialState: initialDrive,
  reducers: {
    driveHydrated(_state, action: PayloadAction<Partial<DriveState> | null>) {
      const saved = { ...initialDrive, ...action.payload };
      // Uploads the app was closed in the middle of count as failed, so they
      // are tried again.
      const backups: Record<string, Backup> = {};
      for (const [id, backup] of Object.entries(saved.backups ?? {})) {
        const cut = backup.status === 'queued' || backup.status === 'uploading';
        backups[id] = cut ? { status: 'failed', error: 'INTERNAL' } : backup;
      }
      return { ...saved, backups };
    },
    driveConnected: {
      reducer(
        state,
        action: PayloadAction<{
          account: DriveAccount;
          folder: DriveItem;
          at: number;
        }>,
      ) {
        const { account, folder, at } = action.payload;
        if (state.account?.email !== account.email) {
          // A new connection (or another account): start fresh, backing up
          // what is made from now on.
          state.backups = {};
          state.autoBackup = true;
          state.autoSince = at;
        }
        state.account = account;
        state.folder = folder;
        state.needsReconnect = false;
      },
      prepare: (payload: { account: DriveAccount; folder: DriveItem }) => ({
        payload: { ...payload, at: Date.now() },
      }),
    },
    driveDisconnected() {
      return initialDrive;
    },
    autoBackupSet: {
      reducer(state, action: PayloadAction<{ on: boolean; at: number }>) {
        state.autoBackup = action.payload.on;
        state.autoSince = action.payload.on ? action.payload.at : null;
      },
      prepare: (on: boolean) => ({ payload: { on, at: Date.now() } }),
    },
    reconnectNeeded(state) {
      state.needsReconnect = true;
    },
    folderFound(state, action: PayloadAction<DriveItem>) {
      state.folder = action.payload;
    },
    backupRequested(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) {
        const status = state.backups[id]?.status;
        if (status !== 'uploading' && status !== 'done') {
          state.backups[id] = { status: 'queued' };
        }
      }
    },
    backupStarted(state, action: PayloadAction<string>) {
      state.backups[action.payload] = { status: 'uploading' };
    },
    backupDone(
      state,
      action: PayloadAction<{ id: string; files: DriveItem[]; at: number }>,
    ) {
      const { id, files, at } = action.payload;
      state.backups[id] = { status: 'done', files, at };
    },
    backupFailed(state, action: PayloadAction<{ id: string; error: string }>) {
      state.backups[action.payload.id] = {
        status: 'failed',
        error: action.payload.error,
      };
    },
    /** Everything still queued fails the same way (offline, Drive full...). */
    queueFailed(state, action: PayloadAction<string>) {
      for (const backup of Object.values(state.backups)) {
        if (backup.status === 'queued') {
          backup.status = 'failed';
          backup.error = action.payload;
        }
      }
    },
    /** Forget entries that left History (their files stay in Drive). */
    backupsPruned(state, action: PayloadAction<string[]>) {
      const keep = new Set(action.payload);
      for (const id of Object.keys(state.backups)) {
        if (!keep.has(id)) {
          delete state.backups[id];
        }
      }
    },
  },
});

export const {
  driveHydrated,
  driveConnected,
  driveDisconnected,
  autoBackupSet,
  reconnectNeeded,
  folderFound,
  backupRequested,
  backupStarted,
  backupDone,
  backupFailed,
  queueFailed,
  backupsPruned,
} = driveSlice.actions;
export default driveSlice.reducer;

/**
 * Results that should be in Drive but aren't, and aren't on their way:
 * new results since automatic backup was turned on, and failed backups that
 * could still work. Retried on start-up and after reconnecting.
 */
export function waitingIds(
  drive: DriveState,
  entries: HistoryEntry[],
): string[] {
  if (!drive.account || drive.needsReconnect) {
    return [];
  }
  return entries
    .filter(e => {
      const backup = drive.backups[e.id];
      if (backup?.status === 'failed') {
        return !HOPELESS.has(backup.error ?? '');
      }
      if (backup) {
        return false;
      }
      return (
        drive.autoBackup &&
        drive.autoSince !== null &&
        e.createdAt >= drive.autoSince
      );
    })
    .map(e => e.id);
}

/** Counts for the Drive screen, and the latest problem worth showing. */
export function backupCounts(drive: DriveState, entries: HistoryEntry[]) {
  let done = 0;
  let active = 0;
  /** Not in Drive yet but could be (a result whose file is gone can't). */
  const notYet: string[] = [];
  let problem: string | undefined;
  for (const e of entries) {
    const backup = drive.backups[e.id];
    if (backup?.status === 'done') {
      done += 1;
    } else if (backup?.status === 'queued' || backup?.status === 'uploading') {
      active += 1;
    } else if (
      !(backup?.status === 'failed' && HOPELESS.has(backup.error ?? ''))
    ) {
      notYet.push(e.id);
      // History is newest first: keep the latest problem.
      problem = problem ?? backup?.error;
    }
  }
  return { done, active, notYet, problem };
}
