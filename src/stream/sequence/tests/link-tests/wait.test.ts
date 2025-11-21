import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Wait', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('basic wait with single value', async () => {
      let heap: string[] = [];

      Sequence.create<string>(resolve => resolve('a'))
        .wait(100)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['a']);
    });

    test('wait with multiple sync values', async () => {
      let heap: string[] = [];

      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .wait(50)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('wait preserves data', async () => {
      let heap: unknown[] = [];

      Sequence.create<unknown>(resolve => {
        resolve('string');
        resolve(123);
        resolve({ key: 'value' });
        resolve([1, 2, 3]);
      })
        .wait(10)
        .read(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(40);
      expect(heap).toEqual(['string', 123, { key: 'value' }, [1, 2, 3]]);
    });

    test('wait with mixed sync and async triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .wait(30)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      resolve('x');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await vi.advanceTimersByTimeAsync(150);
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['a', 'b', 'x', 'k', 't']);
    });

    test('wait maintains execution order', async () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
        resolve('1');
        resolve('2');
      })
        .wait(50)
        .read(data => heap.push(data))
        .attachToRoot();

      setTimeout(() => resolve('3'), 10);
      setTimeout(() => resolve('4'), 20);

      vi.advanceTimersByTime(70);
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1', '2', '3', '4']);
    });

    test('chained waits accumulate delays', async () => {
      let heap: string[] = [];

      Sequence.create<string>(resolve => resolve('a'))
        .wait(50)
        .wait(50)
        .read(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(99);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(heap).toEqual(['a']);
    });

    test('wait after map operation', async () => {
      let heap: string[] = [];

      Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
        resolve(3);
      })
        .map(value => value * 2)
        .wait(30)
        .read(data => heap.push(data.toString()))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(90);
      expect(heap).toEqual(['2', '4', '6']);
    });

    test('map after wait operation', async () => {
      let heap: string[] = [];

      Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
        resolve(3);
      })
        .wait(20)
        .map(value => value * 3)
        .read(data => heap.push(data.toString()))
        .attachToRoot();

      vi.advanceTimersByTime(60);
      expect(heap).toEqual(['3', '6', '9']);
    });

    test('wait with no duration', async () => {
      let heap: string[] = [];

      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
      })
        .wait()
        .read(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(0);
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['a', 'b']);
    });
  });

  describe('Cleanup', () => {
    test('destroying sequence cancels pending waits', async () => {
      let heap: string[] = [];
      let readExecuted = false;

      let sequence = Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .wait(100)
        .read(data => {
          readExecuted = true;
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(readExecuted).toBe(false);

      sequence.destroy();
      vi.advanceTimersByTime(100);

      expect(heap).toEqual([]);
      expect(readExecuted).toBe(false);
    });

    test('destroying parent attachable cancels pending waits', async () => {
      let heap: string[] = [];
      let attachable = new Attachable();

      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
      })
        .wait(100)
        .read(data => heap.push(data))
        .attach(attachable);

      expect(heap).toEqual([]);

      attachable.destroy();
      vi.advanceTimersByTime(100);

      expect(heap).toEqual([]);
    });
  });

  describe('Finalization', () => {
    test('finalization after at creator', async () => {
      let heap: string[] = [];

      Sequence.create<string>((resolve, context) => {
        resolve('a');
        resolve('b');
        context.final();
        resolve('c');
        resolve('d');
      })
        .wait(50)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b']);
    });

    test('finalization after wait when all packages passing together', async () => {
      let heap: string[] = [];

      let sequence = Sequence.create<string>((resolve, context) => {
        resolve('a');
        resolve('b');
        resolve('c');
        context.final();
      })
        .wait(50)
        .read((data, context) => {
          if (data === 'b') {
            context.final();
          }
          heap.push(data);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBe(false);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b']);
      expect(sequence.destroyed).toBe(true);
    });

    test('finalization after wait when all packages passing seperately', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      let sequence = Sequence.create<string>((r, context) => {
        resolve = r;
        resolve('a');
      })
        .wait(50)
        .read((data, context) => {
          if (data === 'b') {
            context.final();
          }
          heap.push(data);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBe(false);

      UnitTestHelper.callEachDelayed(['b', 'c'], resolve);

      await vi.advanceTimersByTimeAsync(60);
      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b']);
      expect(sequence.destroyed).toBe(true);
    });
  });
});
