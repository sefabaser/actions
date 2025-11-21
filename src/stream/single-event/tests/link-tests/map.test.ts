import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { Variable } from '../../../../observables/variable/variable';
import { ActionLib } from '../../../../utilities/action-lib';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Map', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .map(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .map(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Behavior', () => {
    test('sync data chaining', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .map(data => {
          heap.push(data);
          return 1;
        })
        .map(data => {
          heap.push(data);
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 1, undefined]);
    });

    test('async data chaining', async () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .map(data => {
          heap.push(data);
          return 1;
        })
        .map(data => {
          heap.push(data);
          return 'test';
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 1, 'test']);
    });
  });

  describe('Destruction', () => {
    test('destroying single event', () => {
      let singleEvent = SingleEvent.create<void>(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroy single event callback', () => {
      let triggered = false;
      let singleEvent = SingleEvent.create<void>(() => {
        return () => {
          triggered = true;
        };
      })
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      singleEvent.destroy();
      expect(triggered).toBeTruthy();
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attach(parent);

      expect(singleEvent.destroyed).toBeFalsy();
      parent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('object with subscribe property should not fool the map', () => {
      let heap: unknown[] = [];
      let fakeStream = { subscribe: 'hello' };

      SingleEvent.create<void>(resolve => resolve())
        .map(() => fakeStream)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([fakeStream]);
    });

    test('object with subscribe function should not fool the map', () => {
      let heap: unknown[] = [];
      let fakeStream = { subscribe: () => {} };

      SingleEvent.create<void>(resolve => resolve())
        .map(() => fakeStream)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([fakeStream]);
    });

    test('attachments on the context attachable should be destroyed right after the iteration step', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .map((_, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
        })
        .attachToRoot();

      expect(singleEvent.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });
  });
});
