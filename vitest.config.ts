import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/'],
    environment: 'node',
    setupFiles: ['vitest.setup.ts'],
    env: process.env,
    fileParallelism: false,
    testTimeout: 30000,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
