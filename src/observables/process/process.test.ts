import { beforeEach, describe, expect, test } from 'vitest';

import { Process } from './process';

// no registerers on start
// all registerers instantly resolves

// registerer unregisters in the middle of the process
// during the process a new registerer appears
// during a process a new registerer appears and then unregisters
// during a process a resolved registerer being destroyed

// destroying the process should destroy all listener processes
// destroying the process after one child listener destroyed should destroy the remaining children

describe('Process', () => {
  describe('basic behavior', () => {
    let process: Process<number, number, number>;

    beforeEach(() => {
      process = new Process<number, number, number>((acc, value) => acc + value, 0);
    });

    test('defined', () => {
      expect(process).toBeDefined();
    });
  });
});
