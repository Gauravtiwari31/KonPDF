import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import type { JobProgress, JobResult } from '../api/engine';
import { appError, FriendlyError, toFriendlyError } from '../api/errors';
import { MAX_FILE_MB, MAX_FILES } from '../config';
import { entryAdded, newEntryId } from '../features/history/historySlice';
import type { RootStackParamList } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { useAppDispatch } from '../store/hooks';
import type { Family } from '../theme';
import { tick } from '../utils/haptics';
import { useLang } from './useLang';

export type JobPhase = 'idle' | 'upload' | 'work' | 'download' | 'done';

/**
 * Runs an engine job for a tool screen: checks limits, tracks progress, adds
 * the result to History and opens the Result screen. Errors become a
 * FriendlyError for <ErrorCard>, never a raw message.
 */
export function useJob() {
  const dispatch = useAppDispatch();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const lang = useLang();
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<FriendlyError | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (
      inputs: LocalFile[],
      meta: { title: string; family: Family; kind?: 'scan' | 'text' },
      work: (onProgress: JobProgress) => Promise<JobResult>,
    ) => {
      if (running.current) {
        return;
      }
      if (
        inputs.length > MAX_FILES ||
        inputs.some(f => f.size > MAX_FILE_MB * 1024 * 1024)
      ) {
        setError(appError('TOO_BIG_TO_SEND', lang));
        return;
      }
      running.current = true;
      setError(null);
      setPhase('upload');
      setProgress(0);
      try {
        const result = await work((next, ratio) => {
          setPhase(next);
          setProgress(ratio);
        });
        const id = newEntryId();
        dispatch(
          entryAdded({
            id,
            title: meta.title,
            family: meta.family,
            kind: meta.kind,
            createdAt: Date.now(),
            inputCount: inputs.length,
            inputBytes: inputs.reduce((sum, f) => sum + f.size, 0),
            outputs: result.outputs,
            notes: result.notes,
          }),
        );
        setPhase('done');
        tick();
        navigation.navigate('Result', { entryId: id });
      } catch (e) {
        setError(toFriendlyError(e, lang));
        setPhase('idle');
      } finally {
        running.current = false;
      }
    },
    [dispatch, lang, navigation],
  );

  const busy = phase === 'upload' || phase === 'work' || phase === 'download';
  return { run, phase, progress, busy, error, setError };
}

/** Button label while a job runs. */
export function phaseLabel(phase: JobPhase, progress: number): string {
  switch (phase) {
    case 'upload':
      return `Sending ${Math.round(progress * 100)} %`;
    case 'work':
      return 'Working on it…';
    case 'download':
      return 'Fetching the result…';
    default:
      return '';
  }
}
