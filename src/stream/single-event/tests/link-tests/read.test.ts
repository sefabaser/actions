import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLibHardReset } from '../../../../helpers/hard-reset';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Read', () => {
  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .read(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Behavior', () => {
    test('sync read chain', () => {
      let heap: string[] = [];

      SingleEvent.create<void>(resolve => resolve())
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

    test('async read chain', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['test'], data => resolve(data));
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

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['1test', '2test', '3test']);
    });

    test('read should not change the data', () => {
      let heap: string[] = [];
      SingleEvent.create<string>(resolve => resolve('a'))
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
      SingleEvent.create<void>(resolve => resolve())
        .read(data => {
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
        .read(data => heap.push(data))
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
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
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
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      singleEvent.destroy();
      expect(triggered).toBeTruthy();
    });
  });
});
