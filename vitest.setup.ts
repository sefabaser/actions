import { config } from '@memlab/core';
import { afterEach, beforeEach, vi } from 'vitest';

config.muteConsole = true;

let unhandledErrors: Error[] = [];
let consoleErrors: any[] = [];
let originalConsoleError = console.error;

function checkAndThrowErrors() {
  let allErrors: string[] = [];

  if (unhandledErrors.length > 0) {
    allErrors.push(`${unhandledErrors.length} unhandled error(s):\n${unhandledErrors.map(e => e.stack || e.message).join('\n\n')}`);
  }

  if (consoleErrors.length > 0) {
    allErrors.push(`${consoleErrors.length} console.error(s):\n${consoleErrors.map(args => args.map((arg: any) => arg?.stack || String(arg)).join(' ')).join('\n\n')}`);
  }

  if (allErrors.length > 0) {
    unhandledErrors = [];
    consoleErrors = [];
    throw new Error(`Test had errors:\n\n${allErrors.join('\n\n---\n\n')}`);
  }
}

beforeEach(() => {
  consoleErrors = [];

  console.error = (...args: any[]) => {
    consoleErrors.push(args);
    originalConsoleError(...args);
  };
});

afterEach(async () => {
  console.error = originalConsoleError;
  vi.useRealTimers();
  await new Promise<void>(resolve => setTimeout(resolve));
  checkAndThrowErrors();
});

process.on('unhandledRejection', (reason: any) => {
  let error = reason instanceof Error ? reason : new Error(String(reason));
  unhandledErrors.push(error);
});

process.on('uncaughtException', (error: Error) => {
  unhandledErrors.push(error);
});
