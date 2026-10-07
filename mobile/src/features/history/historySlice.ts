import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LocalFile } from '../../services/files';
import type { Family } from '../../theme';

/** One finished job, kept on the phone so results can be opened or shared again. */
export interface HistoryEntry {
  id: string;
  /** "JPG → PDF", "Resize to 50 KB"... */
  title: string;
  family: Family;
  createdAt: number;
  inputCount: number;
  inputBytes: number;
  outputs: LocalFile[];
  notes: string[];
}

export interface HistoryState {
  entries: HistoryEntry[];
}

/** Newest first, and only this many: results are cached copies, not an archive. */
export const HISTORY_LIMIT = 40;

const initialState: HistoryState = { entries: [] };

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    historyHydrated(state, action: PayloadAction<HistoryEntry[] | null>) {
      state.entries = (action.payload ?? []).slice(0, HISTORY_LIMIT);
    },
    entryAdded(state, action: PayloadAction<HistoryEntry>) {
      state.entries = [action.payload, ...state.entries].slice(0, HISTORY_LIMIT);
    },
    entryRemoved(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter(e => e.id !== action.payload);
    },
    historyCleared(state) {
      state.entries = [];
    },
  },
});

export const { historyHydrated, entryAdded, entryRemoved, historyCleared } =
  historySlice.actions;
export default historySlice.reducer;

export const newEntryId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
