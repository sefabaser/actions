import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: './',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    env: {
      QUICK: mode === 'quick' ? '1' : undefined
    }
  },
}));
