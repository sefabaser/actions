import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { ActionLibHardReset } from '../../../../helpers/hard-reset';
import { Action } from '../../../../observables/action/action';
import { Variable } from '../../../../observables/variable/variable';
import { Sequence } from '../../../sequence/sequence';
import { SingleEvent } from '../../single-event';

describe('SingleEvent Async Map', () => {
  let dummySequence = <T>(value: T) => Sequence.create<T>(resolve => resolve(value));
  let dummySingleEvent = <T>(value: T) => SingleEvent.create<T>(resolve => resolve(value));

  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple single event sync trigger', () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => resolve('a'))
        .asyncMap(data => dummySingleEvent(data))
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('simple single event async trigger', async () => {
      let heap: string[] = [];

      SingleEvent.create<string>(resolve => {
        UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
      })
        .asyncMap(data => dummySingleEvent(data))
        .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 1, undefined, 'final']);
      });
    });

    describe('asyncMap returns single event', () => {
      test('instant resolve single event', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => SingleEvent.create<string>(resolveInner => resolveInner(data + 'I')))
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 1, undefined, 'final']);
      });
    });

    describe('asyncMap returns notifier', () => {
      test('sync resolve', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => new Variable<string>(data + 'I'))
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['aI']);
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

  describe('Edge Cases', () => {
    test('attachments on the context attachable should be destroyed right after the iteration step', async () => {
      let variable = new Variable<number>(1);
      let action = new Action<void>();
      let triggered = false;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap((_, context) =>
          SingleEvent.create(r => {
            variable
              .subscribe(() => {
                triggered = true;
                r();
              })
              .attach(context.attachable);
          })
        )
        .asyncMap(() => action)
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(1);
      expect(triggered).toBeTruthy();

      singleEvent.destroy();

      expect(singleEvent.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(0);
    });

    test('destroying subscriptions via attachment, instantly finalizing sequence, in map', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = SingleEvent.create<void>(resolve => {
        resolve();
      })
        .map((_, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
          expect(variable.listenerCount).toEqual(1);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('destroying subscriptions via attachment, instantly finalizing sequence, in returned single event', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = SingleEvent.create<void>(resolve => {
        resolve();
      })
        .asyncMap((_, context) => {
          return SingleEvent.create(resolve => {
            variable
              .subscribe(() => {
                triggered = true;
                resolve();
              })
              .attach(context.attachable);
          });
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('destroying via context attachable during async operation', async () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let singleEvent = SingleEvent.create<void>(resolve => {
        UnitTestHelper.callEachDelayed([undefined], () => resolve());
      })
        .asyncMap((_, context) =>
          SingleEvent.create(r => {
            variable
              .subscribe(() => {
                triggered = true;
                r();
              })
              .attach(context.attachable);
          })
        )
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeFalsy();

      await UnitTestHelper.waitForAllOperations();

      expect(singleEvent.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('using attached event after timeout', async () => {
      let event = SingleEvent.create<void>(resolve => resolve()).attachToRoot();

      await expect(async () => {
        UnitTestHelper.callDelayed(() => {
          let sequence = Sequence.create<void>(resolve => resolve());
          try {
            sequence.asyncMapDirect(() => event).attachToRoot();
          } catch (e) {
            sequence['_executor']['_attachIsCalled'] = true; // silence the error
            throw e;
          }
        });

        await UnitTestHelper.waitForAllOperations();
      }).rejects.toThrow('Single Event: After attaching, you cannot add another operation.');
    });
  });
});
