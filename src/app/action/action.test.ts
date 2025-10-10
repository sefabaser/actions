import { Comparator } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from './action';

class SampleModel {
  testData = '';
}

describe(`Action`, () => {
  describe(`Basics`, () => {
    let action: Action<SampleModel>;

    beforeEach(() => {
      action = new Action<SampleModel>();
    });

    test('should be definable', () => {
      expect(action).toBeDefined();
    });

    test('should be subscribable', () => {
      action.subscribe(_ => {}).attachToRoot();
      expect(action['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    test('subscription should be destroyable', () => {
      let subscription = action.subscribe(_ => {}).attachToRoot();
      subscription.destroy();
      expect(action['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    test('triggerring without listeners', () =>
      new Promise<void>(done => {
        action.trigger({ testData: 'sample' });
        done();
      }));

    test('should notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        action
          .subscribe(message => {
            if (message && message.testData === 'sample') {
              listener1 = true;
              if (listener2) {
                done();
              }
            }
          })
          .attachToRoot();

        action
          .subscribe(message => {
            if (message && message.testData === 'sample') {
              listener2 = true;
              if (listener1) {
                done();
              }
            }
          })
          .attachToRoot();

        action.trigger({ testData: 'sample' });
      }));

    test('should not notify destroyed listeners', () =>
      new Promise<void>(done => {
        let triggered = false;
        let subscription = action
          .subscribe(_ => {
            triggered = true;
          })
          .attachToRoot();
        subscription.destroy();
        action.trigger({ testData: 'sample' });

        setTimeout(() => {
          if (!triggered) {
            done();
          }
        }, 0);
      }));
  });

  describe(`Complex Types`, () => {
    test('should support type: Set', () =>
      new Promise<void>(done => {
        let action = new Action<{ set: Set<string> }>();
        action.subscribe(message => {
          if (message && message.set && Comparator.isSet(message.set)) {
            done();
          }
        });
        action.trigger({
          set: new Set<string>()
        });
      }));

    test('not persistant', () =>
      new Promise<void>(done => {
        let normalAction = new Action<void>();
        normalAction.trigger();

        let triggered = false;
        normalAction.subscribe(() => {
          triggered = true;
        });

        setTimeout(() => {
          if (!triggered) {
            done();
          }
        }, 0);
      }));
  });

  describe(`Wait Until`, () => {
    let action: Action<SampleModel | undefined>;

    beforeEach(() => {
      action = new Action<SampleModel | undefined>();
    });

    test('wait until any change', async () => {
      let resolvedWith: SampleModel | undefined;

      action
        .waitUntilNext(state => {
          resolvedWith = state;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toEqual({ testData: 'sample' });
    });

    test('wait until spesific data', async () => {
      let resolvedWith: SampleModel | undefined;

      action
        .waitUntil({ testData: 'expected' }, state => {
          resolvedWith = state;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'expected' });
      expect(resolvedWith).toEqual({ testData: 'expected' });
    });

    test('wait until undefined', async () => {
      let resolvedWith: SampleModel | undefined;
      let resolved = false;

      action
        .waitUntil(undefined, state => {
          resolvedWith = state;
          resolved = true;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      action.trigger(undefined);
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(true);
    });

    test('wait until promise any change', async () => {
      let resolvedWith: SampleModel | undefined;

      let promise = action.waitUntilNextPromise();
      promise.then(state => {
        resolvedWith = state;
      });

      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toEqual({ testData: 'sample' });
    });

    test('wait until promise spesific data', async () => {
      let resolvedWith: SampleModel | undefined;

      let promise = action.waitUntilPromise({ testData: 'expected' });
      promise.then(state => {
        resolvedWith = state;
      });

      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toBeUndefined();
      action.trigger({ testData: 'expected' });
      expect(resolvedWith).toEqual({ testData: 'expected' });
    });

    test('wait until promise undefined', async () => {
      let resolvedWith: SampleModel | undefined;
      let resolved = false;

      let promise = action.waitUntilPromise(undefined);
      promise.then(state => {
        resolvedWith = state;
        resolved = true;
      });

      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      action.trigger({ testData: 'sample' });
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      action.trigger(undefined);
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(true);
    });
  });
});
