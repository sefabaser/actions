import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { Variable } from '../../../../observables/variable/variable';
import { ActionLib } from '../../../../utilities/action-lib';
import { SingleEvent } from '../../single-event';

describe('SingleEvent MapToVoid', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('simple single event async trigger', async () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([undefined]);
    });
  });

  describe('Behavior', () => {
    test('transforms string data to void', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('test'))
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('transforms number data to void', () => {
      let heap: unknown[] = [];

      SingleEvent.create<number>(resolve => resolve(42))
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('transforms object data to void', () => {
      let heap: unknown[] = [];

      SingleEvent.create<{ value: string }>(resolve => resolve({ value: 'test' }))
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('sync data chaining with mapToVoid', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .tap(data => heap.push(data))
        .mapToVoid()
        .tap(data => heap.push(data))
        .map(data => {
          heap.push(data);
          return 1;
        })
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', undefined, undefined, 1]);
    });

    test('async data chaining with mapToVoid', async () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .tap(data => heap.push(data))
        .mapToVoid()
        .tap(data => heap.push(data))
        .map(() => 'transformed')
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', undefined, 'transformed']);
    });

    test('multiple mapToVoid in chain', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('test'))
        .mapToVoid()
        .tap(data => heap.push(data))
        .map(() => 123)
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined, undefined]);
    });

    test('mapToVoid followed by map operation', () => {
      let heap: unknown[] = [];

      SingleEvent.create<string>(resolve => resolve('original'))
        .mapToVoid()
        .map(() => 'new value')
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['new value']);
    });

    test('mapToVoid at the end of chain', () => {
      let triggered = false;

      SingleEvent.create<string>(resolve => resolve('test'))
        .map(data => data.toUpperCase())
        .mapToVoid()
        .tap(() => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBeTruthy();
    });
  });

  describe('Destruction', () => {
    test('destroying single event', () => {
      let singleEvent = SingleEvent.create<void>(() => {})
        .mapToVoid()
        .map(() => {})
        .mapToVoid()
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
        .mapToVoid()
        .map(() => {})
        .mapToVoid()
        .attachToRoot();

      expect(triggered).toBeFalsy();
      singleEvent.destroy();
      expect(triggered).toBeTruthy();
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .mapToVoid()
        .map(() => {})
        .mapToVoid()
        .attach(parent);

      expect(singleEvent.destroyed).toBeFalsy();
      parent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('attachments on the context attachable should be destroyed right after the iteration step', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let singleEvent = SingleEvent.create<string>(resolve => resolve('test'))
        .mapToVoid()
        .tap((_, context) => {
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

    test('mapToVoid with instant single event', () => {
      let heap: unknown[] = [];

      SingleEvent.instant('immediate')
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('mapToVoid should still trigger downstream operations', () => {
      let tapCallCount = 0;
      let mapCallCount = 0;

      SingleEvent.create<string>(resolve => resolve('data'))
        .mapToVoid()
        .tap(() => {
          tapCallCount++;
        })
        .map(() => {
          mapCallCount++;
        })
        .attachToRoot();

      expect(tapCallCount).toEqual(1);
      expect(mapCallCount).toEqual(1);
    });

    test('mapToVoid does not pass original data downstream', () => {
      let receivedData: unknown;

      SingleEvent.create<string>(resolve => resolve('original data'))
        .mapToVoid()
        .tap(data => {
          receivedData = data;
        })
        .attachToRoot();

      expect(receivedData).toEqual(undefined);
      expect(receivedData).not.toEqual('original data');
    });
  });
});
