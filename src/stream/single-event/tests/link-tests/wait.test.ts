import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Wait', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('basic wait with single value', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .wait(100)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(100);
      expect(heap).toEqual(['a']);
    });

    test('wait delays resolution', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('test'))
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(25);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(25);
      expect(heap).toEqual(['test']);
    });

    test('wait preserves data', () => {
      let heap: unknown[] = [];

      SingleEvent.create<unknown>(resolve => resolve('string'))
        .wait(10)
        .tap(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(10);
      expect(heap).toEqual(['string']);
    });

    test('wait with different data types', () => {
      let stringHeap: string[] = [];
      let numberHeap: number[] = [];
      let objectHeap: unknown[] = [];
      let arrayHeap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('text'))
        .wait(10)
        .tap(data => stringHeap.push(data))
        .attachToRoot();

      SingleEvent.create<number>(resolve => resolve(123))
        .wait(20)
        .tap(data => numberHeap.push(data))
        .attachToRoot();

      SingleEvent.create<unknown>(resolve => resolve({ key: 'value' }))
        .wait(30)
        .tap(data => objectHeap.push(data))
        .attachToRoot();

      SingleEvent.create<unknown>(resolve => resolve([1, 2, 3]))
        .wait(40)
        .tap(data => arrayHeap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(10);
      expect(stringHeap).toEqual(['text']);

      vi.advanceTimersByTime(10);
      expect(numberHeap).toEqual([123]);

      vi.advanceTimersByTime(10);
      expect(objectHeap).toEqual([{ key: 'value' }]);

      vi.advanceTimersByTime(10);
      expect(arrayHeap).toEqual([[1, 2, 3]]);
    });

    test('wait with zero duration', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('immediate'))
        .wait(0)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(0);
      expect(heap).toEqual(['immediate']);
    });

    test('wait with async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['async'], data => resolve(data));
      })
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      await vi.advanceTimersByTimeAsync(50);
      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['async']);
    });
  });

  describe('Chaining', () => {
    test('wait with map', () => {
      let heap: number[] = [];

      SingleEvent.create<string>(resolve => resolve('hello'))
        .wait(50)
        .map(data => data.length)
        .tap(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(50);
      expect(heap).toEqual([5]);
    });

    test('map then wait', () => {
      let heap: number[] = [];

      SingleEvent.create<string>(resolve => resolve('test'))
        .map(data => data.length)
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual([4]);
    });

    test('multiple wait calls', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('data'))
        .wait(30)
        .wait(20)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(30);
      expect(heap).toEqual([]);

      vi.advanceTimersByTime(20);
      expect(heap).toEqual(['data']);
    });

    test('wait in the middle of chain', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('value'))
        .map(data => data.toUpperCase())
        .wait(40)
        .map(data => data.length)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(40);
      expect(heap).toEqual([5]);
    });
  });

  describe('Lifecycle', () => {
    test('destroying single event cancels pending wait', () => {
      let heap: string[] = [];

      let singleEvent = SingleEvent.create<string>(resolve => resolve('a'))
        .wait(100)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      singleEvent.destroy();

      vi.advanceTimersByTime(100);
      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('wait works with attachable scope', () => {
      let heap: string[] = [];
      let attachable = new Attachable().attachToRoot();

      SingleEvent.create<string>(resolve => resolve('a'))
        .wait(50)
        .tap(data => heap.push(data))
        .attach(attachable);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['a']);
    });

    test('destroying parent cancels pending wait', () => {
      let heap: string[] = [];
      let attachable = new Attachable().attachToRoot();

      SingleEvent.create<string>(resolve => resolve('a'))
        .wait(100)
        .tap(data => heap.push(data))
        .attach(attachable);

      expect(heap).toEqual([]);

      attachable.destroy();

      vi.advanceTimersByTime(100);
      expect(heap).toEqual([]);
    });

    test('wait cleanup callback is called on destroy', () => {
      let cleanupCalled = false;

      let singleEvent = SingleEvent.create<string>(() => {
        return () => {
          cleanupCalled = true;
        };
      })
        .wait(100)
        .attachToRoot();

      expect(cleanupCalled).toBeFalsy();

      singleEvent.destroy();

      expect(cleanupCalled).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('wait with no trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(() => {})
        .wait(100)
        .tap(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(200);
      expect(heap).toEqual([]);
    });

    test('wait with instant single event', () => {
      let heap: string[] = [];

      SingleEvent.instant('immediate')
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['immediate']);
    });

    test('multiple single events with different wait durations', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('first'))
        .wait(100)
        .tap(data => heap.push(data))
        .attachToRoot();

      SingleEvent.create<string>(resolve => resolve('second'))
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      SingleEvent.create<string>(resolve => resolve('third'))
        .wait(150)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['second']);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['second', 'first']);

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['second', 'first', 'third']);
    });

    test('wait resolves only once', () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      SingleEvent.create<string>(r => {
        resolve = r;
      })
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('first');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['first']);

      resolve('second');
      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['first']);
    });

    test('wait with undefined value', () => {
      let heap: unknown[] = [];

      SingleEvent.create<undefined>(resolve => resolve(undefined))
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(50);
      expect(heap).toEqual([undefined]);
    });
  });

  describe('Error Handling', () => {
    test('cannot link single event twice', () => {
      let singleEvent = SingleEvent.create<string>(resolve => resolve('a')).wait(100);

      singleEvent.attachToRoot();

      expect(() => singleEvent.attachToRoot()).toThrow();
    });

    test('wait handles errors in resolution gracefully', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        try {
          throw new Error('Test error');
        } catch {
          resolve('recovered');
        }
      })
        .wait(50)
        .tap(data => heap.push(data))
        .attachToRoot();

      vi.advanceTimersByTime(50);
      expect(heap).toEqual(['recovered']);
    });
  });
});
