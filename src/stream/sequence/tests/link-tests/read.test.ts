import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Read', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple sequence sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
      })
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('b');
      expect(heap).toEqual(['a', 'b']);
    });

    test('multiple instant resolution', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('simple sequence mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
    });
  });

  describe('Behavior', () => {
    test('sync read chain', () => {
      let heap: string[] = [];

      Sequence.create(resolve => resolve())
        .read(() => {
          heap.push('a');
        })
        .read(() => {
          heap.push('b');
        })
        .read(() => {
          heap.push('c');
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('instantly finalizing sequence chain', () => {
      let heap: string[] = [];

      Sequence.create((resolve, context) => {
        resolve();
        context.final();
      })
        .read(() => {
          heap.push('a');
        })
        .read(() => {
          heap.push('b');
        })
        .read(() => {
          heap.push('c');
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('mixed read chain', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .read(data => {
          heap.push('1' + data);
        })
        .read(data => {
          heap.push('2' + data);
        })
        .read(data => {
          heap.push('3' + data);
        })
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([
        '1a',
        '2a',
        '3a',
        '1b',
        '2b',
        '3b',
        '1x',
        '2x',
        '3x',
        '1y',
        '2y',
        '3y',
        '1k',
        '2k',
        '3k',
        '1t',
        '2t',
        '3t'
      ]);
    });

    test('read should not change the data', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => resolve('a'))
        .read(data => {
          heap.push('1' + data);
          return 2;
        })
        .read(data => {
          heap.push('2' + data);
        })
        .attachToRoot();

      expect(heap).toEqual(['1a', '2a']);
    });

    test('resolve undefined should still trigger next link', () => {
      let heap: unknown[] = [];
      Sequence.create(resolve => resolve())
        .read(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(resolve => {
        resolve();
        return () => {
          triggered = true;
        };
      })
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });
  });
});
