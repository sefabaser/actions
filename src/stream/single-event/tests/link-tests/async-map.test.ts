import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from '../../../../observables/action/action';
import { Variable } from '../../../../observables/variable/variable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../../sequence/sequence';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Async Map', () => {
  let dummySequence = <T>(value: T) => Sequence.create<T>(resolve => resolve(value));
  let dummySingleEvent = <T>(value: T) => SingleEvent.create<T>(resolve => resolve(value));

  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .asyncMap(data => dummySingleEvent(data))
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .asyncMap(data => dummySingleEvent(data))
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Behavior', () => {
    describe('asyncMap returns sequence', () => {
      test('instant resolve', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => Sequence.create<string>(resolveInner => resolveInner(data + 'I')))
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['aI']);
      });

      test('async resolve', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data =>
            Sequence.create<string>(resolveInner => {
              UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
            })
          )
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['aI']);
      });

      test('data chaining', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => {
            heap.push(data);
            return dummySequence(1);
          })
          .asyncMap(data => {
            heap.push(data);
            return dummySequence(undefined);
          })
          .asyncMap(data => {
            heap.push(data);
            return dummySequence('final');
          })
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 1, undefined, 'final']);
      });
    });

    describe('asyncMap returns single event', () => {
      test('instant resolve single event', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => SingleEvent.create<string>(resolveInner => resolveInner(data + 'I')))
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['aI']);
      });

      test('async resolve', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data =>
            SingleEvent.create<string>(resolveInner => {
              UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
            })
          )
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['aI']);
      });

      test('data chaining', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => {
            heap.push(data);
            return dummySingleEvent(1);
          })
          .asyncMap(data => {
            heap.push(data);
            return dummySingleEvent(undefined);
          })
          .asyncMap(data => {
            heap.push(data);
            return dummySingleEvent('final');
          })
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 1, undefined, 'final']);
      });
    });

    describe('asyncMap returns notifier', () => {
      test('sync resolve', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => new Variable<string>(data + 'I'))
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['aI']);
      });

      test('async resolve', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => {
            let action = new Action<string>();
            UnitTestHelper.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
            return action;
          })
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['aI']);
      });
    });

    describe('map returns value directly', () => {
      test('simple case', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => data + 'I')
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['aI']);
      });

      test('primitive data types', async () => {
        let finalized = false;

        await new Promise<void>(resolve =>
          SingleEvent.instant()
            .asyncMap(() => 1)
            .asyncMap(() => '')
            .asyncMap(() => false)
            .asyncMap(() => ({}))
            .asyncMap(() => undefined)
            .tap(() => {
              finalized = true;
              resolve();
            })
            .attachToRoot()
        );

        expect(finalized).toBeTruthy();
      });
    });
  });

  describe('Destruction', () => {
    describe('asyncMap returns single event', () => {
      test('ongoing execution subscriptions should be destroyed on single event destroy', async () => {
        let triggered = false;
        let innerSingleEvent: SingleEvent<string> | undefined;

        let singleEvent = SingleEvent.create<void>(resolve => resolve())
          .asyncMap(() => {
            innerSingleEvent = SingleEvent.create(r => {
              UnitTestHelper.callDelayed(() => r(''));
            });
            expect(innerSingleEvent['_executor']['_pipeline'].length).toEqual(0);
            return innerSingleEvent;
          })
          .asyncMap(() => {
            triggered = true;
            return dummySingleEvent(undefined);
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

    describe('asyncMap returns notifier', () => {
      test('ongoing execution subscriptions should be destroyed on single event destroy', () => {
        let action = new Action<string>();

        let triggered = false;
        let resolve!: (data: void) => void;
        let singleEvent = SingleEvent.create<void>(r => {
          resolve = r;
        })
          .asyncMap(() => action)
          .asyncMap(() => {
            triggered = true;
            return dummySingleEvent(undefined);
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
