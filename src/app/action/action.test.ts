import { Comparator } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from './action';

class SampleModel {
  testData: string = '';
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
      action.subscribe(message => {});
      expect(action['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    test('should be unsubscribable', () => {
      let subscription = action.subscribe(message => {});
      subscription.unsubscribe();
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

        action.subscribe(message => {
          if (message && message.testData === 'sample') {
            listener1 = true;
            if (listener2) {
              done();
            }
          }
        });

        action.subscribe(message => {
          if (message && message.testData === 'sample') {
            listener2 = true;
            if (listener1) {
              done();
            }
          }
        });

        action.trigger({ testData: 'sample' });
      }));

    test('should not notify unsubscribed listeners', () =>
      new Promise<void>(done => {
        let triggered = false;
        let subscription = action.subscribe(message => {
          triggered = true;
        });
        subscription.unsubscribe();
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
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
      }, 1);
      let nextNotification = await action.waitUntilNext();
      expect(nextNotification).toEqual({ testData: 'sample' });
    });

    test('wait until spesific data', async () => {
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
        action.trigger({ testData: 'expected' });
      }, 1);
      let nextNotification = await action.waitUntil({ testData: 'expected' });
      expect(nextNotification).toEqual({ testData: 'expected' });
    });

    test('wait until undefined', async () => {
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
        action.trigger(undefined);
      }, 1);
      let nextNotification = await action.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });
  });
});
