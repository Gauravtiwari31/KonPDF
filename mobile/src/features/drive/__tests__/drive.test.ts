import { configureStore } from '@reduxjs/toolkit';
import { toFriendlyError } from '../../../api/errors';
import NativeDrive from '../../../native/NativeDrive';
import { drive, driveCode } from '../../../services/drive';
import { FileActionError, LocalFile } from '../../../services/files';
import type { AppDispatch, RootState } from '../../../store';
import historyReducer, {
  HistoryEntry,
  historyHydrated,
} from '../../history/historySlice';
import preferencesReducer from '../../preferences/preferencesSlice';
import { connectDrive, disconnectDrive, runQueue } from '../backup';
import driveReducer, {
  backupCounts,
  backupRequested,
  DriveState,
  driveConnected,
  driveHydrated,
  initialDrive,
  reconnectNeeded,
  waitingIds,
} from '../driveSlice';

jest.mock('../../../native/NativeDrive', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => Promise.resolve(true)),
    authorize: jest.fn(),
    clearToken: jest.fn(() => Promise.resolve()),
    revoke: jest.fn(() => Promise.resolve()),
    upload: jest.fn(),
  },
}));

const native = NativeDrive as jest.Mocked<NonNullable<typeof NativeDrive>>;

const ACCOUNT = { email: 'asha@example.com', name: 'Asha' };
const FOLDER = {
  id: 'folder-1',
  link: 'https://drive.google.com/drive/folders/folder-1',
};

const file = (name: string): LocalFile => ({
  uri: `file:///cache/${name}`,
  path: `/cache/${name}`,
  name,
  mime: 'application/pdf',
  size: 1000,
});

const entry = (
  id: string,
  createdAt: number,
  outputs = [file(`${id}.pdf`)],
): HistoryEntry => ({
  id,
  title: 'JPG → PDF',
  family: 'pdf',
  createdAt,
  inputCount: 1,
  inputBytes: 2000,
  outputs,
  notes: [],
});

/** A Drive JSON answer for the fetch mock. */
const answer = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: () =>
    Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
});

type Route = (url: string, init: { method?: string; body?: string }) => unknown;
const fetchMock = jest.fn();
function driveApi(route: Route) {
  fetchMock.mockImplementation(
    (url: string, init: { method?: string; body?: string }) =>
      Promise.resolve(route(url, init)),
  );
}

function makeStore(entries: HistoryEntry[], driveState: Partial<DriveState>) {
  const store = configureStore({
    reducer: {
      preferences: preferencesReducer,
      history: historyReducer,
      drive: driveReducer,
    },
  });
  store.dispatch(historyHydrated(entries));
  store.dispatch(driveHydrated(driveState));
  return {
    store,
    run: () =>
      runQueue(
        store.dispatch as AppDispatch,
        store.getState as () => RootState,
      ),
    connect: () =>
      connectDrive()(
        store.dispatch as AppDispatch,
        store.getState as () => RootState,
      ),
    disconnect: () =>
      disconnectDrive()(
        store.dispatch as AppDispatch,
        store.getState as () => RootState,
      ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  native.authorize.mockResolvedValue('token-1');
  let n = 0;
  native.upload.mockImplementation(() => {
    n += 1;
    return Promise.resolve(
      JSON.stringify({
        id: `file-${n}`,
        webViewLink: `https://drive/file-${n}`,
      }),
    );
  });
  // The saved folder is still there unless a test says otherwise.
  driveApi(url =>
    url.includes('/files/folder-1')
      ? answer(200, { id: 'folder-1', trashed: false })
      : answer(404, ''),
  );
});

describe('Drive refusals', () => {
  it('turns Drive answers into drive_* codes', () => {
    expect(driveCode(401, '')).toBe('drive_auth');
    expect(driveCode(404, '')).toBe('drive_not_found');
    expect(
      driveCode(
        403,
        '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}',
      ),
    ).toBe('drive_full');
    expect(
      driveCode(403, '{"error":{"errors":[{"reason":"accessNotConfigured"}]}}'),
    ).toBe('drive_not_configured');
    expect(
      driveCode(
        403,
        '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}',
      ),
    ).toBe('drive_busy');
    expect(driveCode(503, '')).toBe('drive_busy');
    expect(driveCode(400, 'Bad Request')).toBe('drive_failed');
  });

  it('puts every Drive problem in words, never a status code', () => {
    const cases: Record<string, string> = {
      drive_unavailable: 'DRIVE_UNAVAILABLE',
      drive_not_configured: 'DRIVE_NOT_SET_UP',
      drive_signed_out: 'DRIVE_SIGNED_OUT',
      drive_auth: 'DRIVE_SIGNED_OUT',
      drive_network: 'DRIVE_UNREACHABLE',
      drive_full: 'DRIVE_FULL',
      drive_busy: 'DRIVE_BUSY',
      drive_failed: 'INTERNAL',
      missing: 'FILE_GONE',
    };
    for (const [code, friendly] of Object.entries(cases)) {
      const e = toFriendlyError(
        new FileActionError(code, 'HTTP 403 forbidden'),
        'en',
      );
      expect(e.code).toBe(friendly);
      expect(`${e.title} ${e.message}`).not.toMatch(/\b[45]\d\d\b/);
    }
  });

  it('reads a native upload refusal as a Drive problem', async () => {
    native.upload.mockRejectedValueOnce(
      Object.assign(
        new Error('{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}'),
        {
          code: 'drive_http_403',
        },
      ),
    );
    await expect(
      drive.upload('t', file('a.pdf'), 'folder-1', {
        title: 'x',
        entryId: 'e1',
      }),
    ).rejects.toMatchObject({ code: 'drive_full' });
  });
});

describe('drive state', () => {
  it('turns automatic backup on for a new connection, from that moment', () => {
    const state = driveReducer(
      initialDrive,
      driveConnected({ account: ACCOUNT, folder: FOLDER }),
    );
    expect(state.account).toEqual(ACCOUNT);
    expect(state.autoBackup).toBe(true);
    expect(state.autoSince).toEqual(expect.any(Number));
  });

  it('keeps the settings and backups when the same account reconnects', () => {
    const before: DriveState = {
      ...initialDrive,
      account: ACCOUNT,
      folder: FOLDER,
      autoBackup: false,
      needsReconnect: true,
      backups: { e1: { status: 'done', files: [] } },
    };
    const state = driveReducer(
      before,
      driveConnected({ account: ACCOUNT, folder: FOLDER }),
    );
    expect(state.needsReconnect).toBe(false);
    expect(state.autoBackup).toBe(false);
    expect(state.backups.e1.status).toBe('done');
  });

  it('starts over for a different account', () => {
    const before: DriveState = {
      ...initialDrive,
      account: ACCOUNT,
      backups: { e1: { status: 'done', files: [] } },
    };
    const state = driveReducer(
      before,
      driveConnected({
        account: { email: 'other@example.com', name: 'O' },
        folder: FOLDER,
      }),
    );
    expect(state.backups).toEqual({});
  });

  it('treats uploads cut short by closing the app as failed, so they are retried', () => {
    const state = driveReducer(
      initialDrive,
      driveHydrated({
        account: ACCOUNT,
        backups: { e1: { status: 'uploading' } },
      }),
    );
    expect(state.backups.e1).toEqual({ status: 'failed', error: 'INTERNAL' });
  });

  it('knows which results are still waiting for Drive', () => {
    const entries = [
      entry('new', 2000),
      entry('gone', 1900),
      entry('failed', 1500),
      entry('old', 500),
    ];
    const state: DriveState = {
      ...initialDrive,
      account: ACCOUNT,
      autoBackup: true,
      autoSince: 1000,
      backups: {
        gone: { status: 'failed', error: 'FILE_GONE' },
        failed: { status: 'failed', error: 'DRIVE_UNREACHABLE' },
      },
    };
    expect(waitingIds(state, entries)).toEqual(['new', 'failed']);
    expect(waitingIds({ ...state, autoBackup: false }, entries)).toEqual([
      'failed',
    ]);
    expect(waitingIds({ ...state, needsReconnect: true }, entries)).toEqual([]);
  });

  it('counts for the Drive screen, leaving out results whose file is gone', () => {
    const entries = [
      entry('a', 4),
      entry('b', 3),
      entry('c', 2),
      entry('d', 1),
    ];
    const state: DriveState = {
      ...initialDrive,
      account: ACCOUNT,
      backups: {
        a: { status: 'failed', error: 'FILE_GONE' },
        b: { status: 'failed', error: 'DRIVE_FULL' },
        c: { status: 'uploading' },
        d: { status: 'done', files: [] },
      },
    };
    expect(backupCounts(state, entries)).toEqual({
      done: 1,
      active: 1,
      notYet: ['b'],
      problem: 'DRIVE_FULL',
    });
  });
});

describe('backing up', () => {
  const connected = {
    account: ACCOUNT,
    folder: FOLDER,
    autoBackup: true,
    autoSince: 0,
  };

  it('uploads every file of a result into KonPDF’s folder', async () => {
    const two = entry('e1', 1000, [file('a.pdf'), file('b.pdf')]);
    const { store, run } = makeStore([two], connected);
    store.dispatch(backupRequested(['e1']));
    await run();

    expect(native.authorize).toHaveBeenCalledWith(ACCOUNT.email, false);
    expect(native.upload).toHaveBeenCalledTimes(2);
    const [token, path, mime, metadata] = native.upload.mock.calls[0];
    expect([token, path, mime]).toEqual([
      'token-1',
      '/cache/a.pdf',
      'application/pdf',
    ]);
    expect(JSON.parse(metadata)).toMatchObject({
      name: 'a.pdf',
      parents: ['folder-1'],
      appProperties: { konpdfEntry: 'e1' },
    });
    expect(store.getState().drive.backups.e1).toMatchObject({
      status: 'done',
      files: [
        { id: 'file-1', link: 'https://drive/file-1' },
        { id: 'file-2', link: 'https://drive/file-2' },
      ],
    });
  });

  it('gets a fresh token once when Drive says the old one ran out', async () => {
    native.authorize.mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    native.upload.mockRejectedValueOnce(
      Object.assign(new Error(''), { code: 'drive_http_401' }),
    );
    // The folder check also needs a valid token.
    driveApi(() => answer(200, { id: 'folder-1', trashed: false }));
    const { store, run } = makeStore([entry('e1', 1000)], connected);
    store.dispatch(backupRequested(['e1']));
    await run();

    expect(native.clearToken).toHaveBeenCalledWith('old');
    expect(native.upload).toHaveBeenLastCalledWith(
      'new',
      '/cache/e1.pdf',
      'application/pdf',
      expect.any(String),
    );
    expect(store.getState().drive.backups.e1.status).toBe('done');
  });

  it('pauses backups and asks to reconnect when Drive access has ended', async () => {
    native.authorize.mockRejectedValue(
      Object.assign(new Error(''), { code: 'drive_signed_out' }),
    );
    const { store, run } = makeStore(
      [entry('e2', 2000), entry('e1', 1000)],
      connected,
    );
    store.dispatch(backupRequested(['e1', 'e2']));
    await run();

    const { drive: state } = store.getState();
    expect(state.needsReconnect).toBe(true);
    expect(state.backups.e1).toEqual({
      status: 'failed',
      error: 'DRIVE_SIGNED_OUT',
    });
    expect(state.backups.e2).toEqual({
      status: 'failed',
      error: 'DRIVE_SIGNED_OUT',
    });
    expect(native.upload).not.toHaveBeenCalled();
  });

  it('finds or makes the folder again when it was put in the bin', async () => {
    const posts: unknown[] = [];
    driveApi((url, init) => {
      if (url.includes('/files/folder-1')) {
        return answer(200, { id: 'folder-1', trashed: true });
      }
      if (init.method === 'POST') {
        posts.push(JSON.parse(init.body ?? '{}'));
        return answer(200, {
          id: 'folder-2',
          webViewLink: 'https://drive/folder-2',
        });
      }
      return answer(200, { files: [] });
    });
    const { store, run } = makeStore([entry('e1', 1000)], connected);
    store.dispatch(backupRequested(['e1']));
    await run();

    expect(posts).toEqual([
      {
        name: 'KonPDF',
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: { konpdf: 'folder' },
      },
    ]);
    expect(store.getState().drive.folder).toEqual({
      id: 'folder-2',
      link: 'https://drive/folder-2',
    });
    expect(JSON.parse(native.upload.mock.calls[0][3]).parents).toEqual([
      'folder-2',
    ]);
  });

  it('stops for now when offline, keeping the files on the phone', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { store, run } = makeStore(
      [entry('e2', 2000), entry('e1', 1000)],
      connected,
    );
    store.dispatch(backupRequested(['e1', 'e2']));
    await run();

    const { backups } = store.getState().drive;
    expect(backups.e1).toEqual({
      status: 'failed',
      error: 'DRIVE_UNREACHABLE',
    });
    expect(backups.e2).toEqual({
      status: 'failed',
      error: 'DRIVE_UNREACHABLE',
    });
    expect(store.getState().drive.needsReconnect).toBe(false);
  });

  it('carries on with the next result when one file is gone', async () => {
    native.upload.mockRejectedValueOnce(
      Object.assign(new Error(''), { code: 'missing' }),
    );
    const { store, run } = makeStore(
      [entry('e2', 2000), entry('e1', 1000)],
      connected,
    );
    store.dispatch(backupRequested(['e1', 'e2']));
    await run();

    const { backups } = store.getState().drive;
    expect(backups.e1).toEqual({ status: 'failed', error: 'FILE_GONE' });
    expect(backups.e2.status).toBe('done');
  });
});

describe('connecting', () => {
  it('does nothing when the person backs out of Google’s screens', async () => {
    native.authorize.mockResolvedValue('');
    const { store, connect } = makeStore([], {});
    await expect(connect()).resolves.toBe(false);
    expect(native.authorize).toHaveBeenCalledWith('', true);
    expect(store.getState().drive.account).toBeNull();
  });

  it('remembers the account and its folder', async () => {
    driveApi(url =>
      url.includes('/about')
        ? answer(200, {
            user: { displayName: 'Asha', emailAddress: 'asha@example.com' },
          })
        : answer(200, {
            files: [{ id: 'folder-1', webViewLink: FOLDER.link }],
          }),
    );
    const { store, connect } = makeStore([], {});
    await expect(connect()).resolves.toBe(true);
    expect(store.getState().drive).toMatchObject({
      account: ACCOUNT,
      folder: FOLDER,
      autoBackup: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('about?fields=user');
    expect(init.headers.Authorization).toBe('Bearer token-1');
  });

  it('reconnects the same account without the account picker', async () => {
    driveApi(url =>
      url.includes('/about')
        ? answer(200, {
            user: { displayName: 'Asha', emailAddress: 'asha@example.com' },
          })
        : answer(200, { files: [{ id: 'folder-1' }] }),
    );
    const { store, connect } = makeStore([], {
      account: ACCOUNT,
      folder: FOLDER,
    });
    store.dispatch(reconnectNeeded());
    await connect();
    expect(native.authorize).toHaveBeenCalledWith(ACCOUNT.email, true);
    expect(store.getState().drive.needsReconnect).toBe(false);
  });

  it('forgets the account on disconnect, even if Google can’t be told', async () => {
    native.revoke.mockRejectedValue(
      Object.assign(new Error(''), { code: 'drive_network' }),
    );
    const { store, disconnect } = makeStore([], {
      account: ACCOUNT,
      folder: FOLDER,
      autoBackup: true,
    });
    await disconnect();
    expect(native.revoke).toHaveBeenCalledWith(ACCOUNT.email);
    expect(store.getState().drive).toEqual(initialDrive);
  });
});
