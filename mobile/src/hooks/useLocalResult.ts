import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import {
  entryAdded,
  HistoryEntry,
  newEntryId,
} from '../features/history/historySlice';
import type { RootStackParamList } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { useAppDispatch } from '../store/hooks';
import { tick } from '../utils/haptics';

/**
 * Files made on the phone itself (a scanned PDF, a text file): added to
 * History like an engine result, then shown on the Result screen.
 */
export function useLocalResult() {
  const dispatch = useAppDispatch();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return useCallback(
    (
      inputs: LocalFile[],
      outputs: LocalFile[],
      meta: Pick<HistoryEntry, 'title' | 'family'> &
        Partial<Pick<HistoryEntry, 'notes' | 'kind'>>,
    ) => {
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
          outputs,
          notes: meta.notes ?? [],
        }),
      );
      tick();
      navigation.navigate('Result', { entryId: id });
    },
    [dispatch, navigation],
  );
}
