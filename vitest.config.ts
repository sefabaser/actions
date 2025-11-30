import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: './',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'queueMicrotask'],
    },
    env: {
      QUICK: mode === 'quick' ? '1' : undefined
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--expose-gc']
      }
    }
  },
}));
