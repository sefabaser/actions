import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: './',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'queueMicrotask'],
    },
    env: mode === 'quick' ? { QUICK: '1' } : {},
    execArgv: ['--expose-gc']
  },
}));
