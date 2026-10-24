/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // Generous for slow CI runners (vitest's defaults are 5s and 10s); a hung test still fails.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
