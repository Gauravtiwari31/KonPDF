import { useCallback, useEffect, useRef, useState } from 'react';
import NativeModel from '../../native/NativeModel';
import { useAppSelector } from '../../store/hooks';
import { AI_READER, AI_READER_BYTES, DeviceInfo } from './model';

export type ModelPhase =
  | 'checking'
  | 'none'
  | 'downloading'
  | 'verifying'
  | 'paused'
  | 'ready'
  | 'failed';

export interface ModelStatus {
  phase: ModelPhase;
  bytes: number;
  total: number;
  /** needs_wifi | no_space | network | corrupt | failed */
  error?: string;
}

interface FileStatus {
  state: 'idle' | 'running' | 'verifying' | 'paused' | 'done' | 'failed';
  bytes: number;
  total: number;
  error?: string | null;
}

export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  try {
    return NativeModel ? (JSON.parse(await NativeModel.deviceInfo()) as DeviceInfo) : null;
  } catch {
    return null;
  }
}

/** Both model files downloaded and verified. */
export async function isAiReaderReady(): Promise<boolean> {
  if (!NativeModel) {
    return false;
  }
  try {
    const found = await Promise.all(AI_READER.files.map(f => NativeModel!.modelPath(f.name)));
    return found.every(Boolean);
  } catch {
    return false;
  }
}

/** The model files' combined state, from each file's. */
export function combine(list: FileStatus[]): ModelStatus {
  const bytes = list.reduce((s, f) => s + (f.state === 'done' ? f.total || f.bytes : f.bytes), 0);
  const base = { bytes: Math.min(bytes, AI_READER_BYTES), total: AI_READER_BYTES };
  if (list.every(f => f.state === 'done')) {
    return { ...base, phase: 'ready', bytes: AI_READER_BYTES };
  }
  const failed = list.find(f => f.state === 'failed');
  if (failed) {
    return { ...base, phase: 'failed', error: failed.error ?? 'failed' };
  }
  if (list.some(f => f.state === 'running')) {
    return { ...base, phase: 'downloading' };
  }
  if (list.some(f => f.state === 'verifying')) {
    return { ...base, phase: 'verifying' };
  }
  if (bytes > 0) {
    return { ...base, phase: 'paused' };
  }
  return { ...base, phase: 'none' };
}

/**
 * The AI reader's download: start, pause, resume, delete, with progress. The
 * download itself runs in native code and carries on while this screen is
 * closed; reopening it picks the progress up again.
 */
export function useAiReaderModel() {
  const wifiOnly = useAppSelector(s => s.preferences.wifiOnly);
  const [status, setStatus] = useState<ModelStatus>({
    phase: 'checking',
    bytes: 0,
    total: AI_READER_BYTES,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!NativeModel) {
      setStatus({ phase: 'none', bytes: 0, total: AI_READER_BYTES });
      return 'none' as ModelPhase;
    }
    const list = await Promise.all(
      AI_READER.files.map(
        async f => JSON.parse(await NativeModel!.downloadStatus(f.name)) as FileStatus,
      ),
    );
    const next = combine(list);
    setStatus(next);
    return next.phase;
  }, []);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    NativeModel?.keepScreenOn(false);
  }, []);

  const startPolling = useCallback(() => {
    if (timer.current) {
      return;
    }
    // Long downloads stop when the screen sleeps on some phones.
    NativeModel?.keepScreenOn(true);
    timer.current = setInterval(async () => {
      const phase = await refresh();
      if (phase !== 'downloading' && phase !== 'verifying') {
        stopPolling();
      }
    }, 700);
  }, [refresh, stopPolling]);

  useEffect(() => {
    refresh().then(phase => {
      if (phase === 'downloading' || phase === 'verifying') {
        startPolling();
      }
    });
    return stopPolling;
  }, [refresh, startPolling, stopPolling]);

  const download = useCallback(async () => {
    if (!NativeModel) {
      return;
    }
    // Both files at once: the native side downloads two in parallel.
    await Promise.all(
      AI_READER.files.map(f =>
        NativeModel!.startDownload(f.url, f.name, f.sha256, f.size, wifiOnly),
      ),
    );
    await refresh();
    startPolling();
  }, [refresh, startPolling, wifiOnly]);

  const pause = useCallback(async () => {
    await Promise.all(AI_READER.files.map(f => NativeModel?.pauseDownload(f.name)));
    setTimeout(refresh, 800);
  }, [refresh]);

  const remove = useCallback(async () => {
    stopPolling();
    await NativeModel?.deleteModels();
    await refresh();
  }, [refresh, stopPolling]);

  return { status, download, pause, remove, refresh };
}
