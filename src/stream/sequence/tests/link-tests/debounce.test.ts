import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('basic debounce with single value', () => {
      let heap: string[] = [];

      Sequence.create<string>(resolve => resolve('a'))
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['a']);
    });

    test('debounce drops previous pending values', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual([]);

      resolve('b');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['b']);
    });

    test('no duration debounce drops previous pending values', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce()
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      expect(heap).toEqual([]);

      resolve('b');
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(0);
      expect(heap).toEqual(['b']);
    });

    test('multiple rapid triggers only emit last value', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      resolve('b');
      resolve('c');
      resolve('d');

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['d']);
    });

    test('debounce with spaced out triggers', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a']);

      resolve('b');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b']);

      resolve('c');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('debounce resets timer on each new value', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      vi.advanceTimersByTime(90);
      expect(heap).toEqual([]);

      resolve('b');
      vi.advanceTimersByTime(90);
      expect(heap).toEqual([]);

      resolve('c');
      vi.advanceTimersByTime(90);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(10);
      expect(heap).toEqual(['c']);
    });

    test('debounce preserves data', () => {
      let heap: unknown[] = [];
      let resolve!: (data: unknown) => void;

      Sequence.create<unknown>(r => {
        resolve = r;
      })
        .debounce(10)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('string');
      vi.advanceTimersByTime(10);

      resolve(123);
      vi.advanceTimersByTime(10);

      resolve({ key: 'value' });
      vi.advanceTimersByTime(10);

      resolve([1, 2, 3]);
      vi.advanceTimersByTime(10);

      expect(heap).toEqual(['string', 123, { key: 'value' }, [1, 2, 3]]);
    });

    test('debounce with zero duration', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(0)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      resolve('b');
      resolve('c');

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(0);
      expect(heap).toEqual(['c']);
    });

    test('debounce with mixed sync and async triggers', async () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .debounce(30)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(30);
      expect(heap).toEqual(['b']);

      resolve('x');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await vi.advanceTimersByTimeAsync(150);
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['b', 't']);
    });
  });

  describe('Chaining', () => {
    test('debounce with map', () => {
      let heap: number[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .map(data => data.length)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      resolve('abc');
      resolve('hello');

      vi.advanceTimersByTime(50);
      expect(heap).toEqual([5]);
    });

    test('debounce with filter', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .filter(data => data.length > 2)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      resolve('ab');
      resolve('abc');

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['abc']);

      resolve('x');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['abc']);
    });

    test('multiple debounce calls', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(30)
        .debounce(20)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      resolve('b');

      vi.advanceTimersByTime(30);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(20);
      expect(heap).toEqual(['b']);
    });
  });

  describe('Lifecycle', () => {
    test('destroying sequence cancels pending debounce', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      let sequence = Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      expect(heap).toEqual([]);

      sequence.destroy();

      vi.advanceTimersByTime(100);
      expect(heap).toEqual([]);
    });

    test('finalization completes pending debounce before finalizing', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;
      let finalizeContext: (() => void) | undefined;

      Sequence.create<string>((r, context) => {
        resolve = r;
        finalizeContext = () => context.final();
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['a']);

      finalizeContext!();
      resolve('b');

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['a']);
    });

    test('debounce works with attachable scope', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;
      let attachable = new Attachable().attachToRoot();

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .read(data => heap.push(data))
        .attach(attachable);

      resolve('a');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a']);

      resolve('b');
      attachable.destroy();

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a']);
    });
  });

  describe('Edge Cases', () => {
    test('debounce with no triggers', () => {
      let heap: string[] = [];

      Sequence.create<string>(() => {})
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(200);
      expect(heap).toEqual([]);
    });

    test('debounce with very rapid triggers', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(100)
        .read(data => heap.push(data))
        .attachToRoot();

      for (let i = 0; i < 100; i++) {
        resolve(`value${i}`);
        vi.advanceTimersByTime(1);
      }

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['value99']);
    });

    test('debounce maintains context between multiple values', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('first');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['first']);

      resolve('second');
      resolve('third');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['first', 'third']);

      resolve('fourth');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['first', 'third', 'fourth']);
    });

    test('debounce with take limits values after debounce', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      Sequence.create<string>(r => {
        resolve = r;
      })
        .debounce(50)
        .take(2)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('a');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a']);

      resolve('b');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b']);

      resolve('c');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a', 'b']);
    });
  });

  describe('Error Handling', () => {
    test('cannot link sequence twice', () => {
      let sequence = Sequence.create<string>(resolve => resolve('a')).debounce(100);

      sequence.attachToRoot();

      expect(() => sequence.attachToRoot()).toThrow();
    });
  });
});
