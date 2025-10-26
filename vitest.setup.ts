import { config } from '@memlab/core';
import { afterEach, vi } from 'vitest';

config.muteConsole = true;

afterEach(() => {
  vi.useRealTimers()
});
