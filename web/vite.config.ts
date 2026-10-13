import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The app's privacy policy is read from ../docs, so it has one source.
  server: { fs: { allow: ['..'] } },
});
