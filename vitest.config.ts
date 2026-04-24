import path from 'node:path';

import { defineConfig } from 'vitest/config';

import { loadOptionalEnvFile } from './lib/load-optional-env-file';

loadOptionalEnvFile('.env.local');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    exclude: ['.worktrees/**', 'node_modules/**', 'dist/**', '.next/**'],
  },
});
