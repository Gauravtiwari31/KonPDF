import { configureStore } from '@reduxjs/toolkit';
import driveReducer from '../features/drive/driveSlice';
import historyReducer from '../features/history/historySlice';
import preferencesReducer from '../features/preferences/preferencesSlice';
import { listener } from './listeners';

export const store = configureStore({
  reducer: {
    preferences: preferencesReducer,
    history: historyReducer,
    drive: driveReducer,
  },
  middleware: getDefault => getDefault().prepend(listener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
