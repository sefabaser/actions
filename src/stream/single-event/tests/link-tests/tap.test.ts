import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Tap', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Behavior', () => {
    test('sync tap chain', () => {
      let heap: string[] = [];

      SingleEvent.create<void>(resolve => resolve())
        .tap(() => {
          heap.push('a');
        })
        .tap(() => {
          heap.push('b');
        })
        .tap(() => {
          heap.push('c');
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('async tap chain', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['test'], data => resolve(data));
      })
        .tap(data => {
          heap.push('1' + data);
        })
        .tap(data => {
          heap.push('2' + data);
        })
        .tap(data => {
          heap.push('3' + data);
        })
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['1test', '2test', '3test']);
    });

    test('tap should not change the data', () => {
      let heap: string[] = [];
      SingleEvent.create<string>(resolve => resolve('a'))
        .tap(data => {
          heap.push('1' + data);
          return 2;
        })
        .tap(data => {
          heap.push('2' + data);
        })
        .attachToRoot();

      expect(heap).toEqual(['1a', '2a']);
    });

    test('resolve undefined should still trigger next link', () => {
      let heap: unknown[] = [];
      SingleEvent.create<void>(resolve => resolve())
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('single event should complete after first trigger', async () => {
      let heap: string[] = [];
      let resolve!: (data: string) => void;

      let singleEvent = SingleEvent.create<string>(r => {
        resolve = r;
      })
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeFalsy();

      resolve('first');
      expect(heap).toEqual(['first']);
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Destruction', () => {
    test('destroying single event', () => {
      let singleEvent = SingleEvent.create<void>(() => {})
        .tap(() => {})
        .tap(() => {})
        .tap(() => {})
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .tap(() => {})
        .tap(() => {})
        .tap(() => {})
        .attach(parent);

      expect(singleEvent.destroyed).toBeFalsy();
      parent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroy single event callback', () => {
      let triggered = false;
      let singleEvent = SingleEvent.create<void>(() => {
        return () => {
          triggered = true;
        };
      })
        .tap(() => {})
        .tap(() => {})
        .tap(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      singleEvent.destroy();
      expect(triggered).toBeTruthy();
    });
  });
});
