import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from '../../../../observables/action/action';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../../sequence/sequence';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Async Tap', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .asyncTap(data => SingleEvent.instant(data))
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .asyncTap(data => SingleEvent.instant(data))
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Behavior', () => {
    test('sync callback chain', () => {
      let heap: string[] = [];

      Sequence.create(resolve => resolve())
        .asyncTap(() => {
          heap.push('a');
        })
        .asyncTap(() => {
          heap.push('b');
        })
        .asyncTap(() => {
          heap.push('c');
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('async callback chain', async () => {
      let heap: string[] = [];
      let resolve1!: () => void;
      let resolve2!: () => void;

      Sequence.create<string>(resolve => resolve('value'))
        .asyncTap(value => {
          heap.push(value + '1');
          return SingleEvent.create<void>(r => {
            resolve1 = r;
          });
        })
        .asyncTap(value => {
          heap.push(value + '2');
          return SingleEvent.create<void>(r => {
            resolve2 = r;
          });
        })
        .tap(value => heap.push(value + 'f'))
        .attachToRoot();

      expect(heap).toEqual(['value1']);

      resolve1();
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['value1', 'value2']);

      resolve2();
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['value1', 'value2', 'valuef']);
    });
  });

  describe('Destruction', () => {
    describe('asyncTap returns single event', () => {
      test('ongoing execution subscriptions should be destroyed on single event destroy', async () => {
        let triggered = false;
        let innerSingleEvent: SingleEvent<string> | undefined;

        let singleEvent = SingleEvent.create<void>(resolve => resolve())
          .asyncTap(() => {
            innerSingleEvent = SingleEvent.create(r => {
              UnitTestHelper.callDelayed(() => r(''));
            });
            expect(innerSingleEvent['_executor']['_pipeline'].length).toEqual(0);
            return innerSingleEvent;
          })
          .asyncTap(() => {
            triggered = true;
            return SingleEvent.instant(undefined);
          })
          .attachToRoot();

        expect(innerSingleEvent).toBeDefined();
        expect(innerSingleEvent!['_executor']['_pipeline'].length).toEqual(1);

        singleEvent.destroy();
        expect(innerSingleEvent!.destroyed).toBeTruthy();

        await UnitTestHelper.waitForAllOperations();
        expect(triggered).toEqual(false);
      });
    });

    describe('asyncTap returns notifier', () => {
      test('ongoing execution subscriptions should be destroyed on single event destroy', () => {
        let action = new Action<string>();

        let triggered = false;
        let resolve!: (data: void) => void;
        let singleEvent = SingleEvent.create<void>(r => {
          resolve = r;
        })
          .asyncTap(() => action)
          .asyncTap(() => {
            triggered = true;
            return SingleEvent.instant(undefined);
          })
          .attachToRoot();

        expect(triggered).toEqual(false);
        expect(action.listenerCount).toEqual(0);

        resolve();

        expect(action.listenerCount).toEqual(1);

        singleEvent.destroy();
        expect(action.listenerCount).toEqual(0);

        action.trigger('');
        expect(triggered).toEqual(false);
      });
    });
  });
});
