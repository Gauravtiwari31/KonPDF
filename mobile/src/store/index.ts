import { configureStore } from '@reduxjs/toolkit';
import historyReducer from '../features/history/historySlice';
import preferencesReducer from '../features/preferences/preferencesSlice';
import { listener } from './listeners';

export const store = configureStore({
  reducer: {
    preferences: preferencesReducer,
    history: historyReducer,
  },
  middleware: getDefault => getDefault().prepend(listener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
