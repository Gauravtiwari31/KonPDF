/* global jest */
// Native modules don't exist under Jest; swap in the official in-memory mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// The app's own Turbo Module (src/native) is Kotlin code; tests use this stand-in.
jest.mock('./src/native/NativeDevice', () => ({
  __esModule: true,
  default: {
    pickFiles: jest.fn(() => Promise.resolve('[]')),
    takeSharedFiles: jest.fn(() => Promise.resolve('[]')),
    downloadFile: jest.fn(),
    saveFile: jest.fn(() => Promise.resolve(true)),
    shareFiles: jest.fn(() => Promise.resolve()),
    openFile: jest.fn(() => Promise.resolve()),
    deleteFile: jest.fn(() => Promise.resolve()),
  },
}));
