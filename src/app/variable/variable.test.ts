import { Comparator, Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Variable } from './variable';

class SampleModel {
  testData = '';
}

describe(`Variable`, () => {
  describe(`Basics`, () => {
    let variable: Variable<SampleModel>;

    beforeEach(() => {
      variable = new Variable<SampleModel>();
    });

    test('should be definable', () => {
      expect(variable).toBeDefined();
    });

    test('should be subscribable', () => {
      variable.subscribe(_ => {});
      expect(variable['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    test('should be unsubscribable', () => {
      let subscription = variable.subscribe(_ => {});
      subscription.unsubscribe();
      expect(variable['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    test('triggerring without listeners', () =>
      new Promise<void>(done => {
        variable.set({ testData: 'sample' });
        done();
      }));

    test('should notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        variable.subscribe(message => {
          if (message && message.testData === 'sample') {
            listener1 = true;
            if (listener2) {
              done();
            }
          }
        });

        variable.subscribe(message => {
          if (message && message.testData === 'sample') {
            listener2 = true;
            if (listener1) {
              done();
            }
          }
        });

        variable.set({ testData: 'sample' });
      }));

    test('should be able to use subscribe only new changes', () => {
      let triggered = false;
      variable.set({ testData: 'sample1' });

      variable.subscribe(
        () => {
          triggered = true;
        },
        { listneOnlyNewChanges: true }
      );

      expect(triggered).toEqual(false);
      variable.set({ testData: 'sample2' });
      expect(triggered).toEqual(true);
    });

    test('should not notify unsubscribed listeners', async () => {
      let triggered = false;
      let subscription = variable.subscribe(_ => {
        triggered = true;
      });
      subscription.unsubscribe();

      variable.set({ testData: 'sample' });

      await Wait();
      expect(triggered).toBeFalsy();
    });

    test('should not notify subscription before the trigger', async () => {
      let triggered = false;
      variable.subscribe(_ => {
        triggered = true;
      });

      await Wait();
      expect(triggered).toBeFalsy();
    });
  });

  describe(`Complex Types`, () => {
    test('should support type: Set', () =>
      new Promise<void>(done => {
        let variable = new Variable<{ set: Set<string> }>();
        variable.set({
          set: new Set<string>()
        });
        variable.subscribe(message => {
          if (message && message.set && Comparator.isSet(message.set)) {
            done();
          }
        });
      }));
  });

  describe(`Persistency`, () => {
    test('persistent', () =>
      new Promise<void>(done => {
        let persistentVariable = new Variable<boolean>();
        persistentVariable.set(true);
        persistentVariable.subscribe(() => {
          done();
        });
      }));
  });

  describe(`Notify Only On Change Option`, () => {
    test('should notify only on change when it is on', () => {
      let variable = new Variable<boolean>({ notifyOnChange: true });

      let triggerCount = 0;
      variable.subscribe(() => {
        triggerCount++;
      });

      variable.set(true);
      variable.set(true);
      variable.set(true);
      variable.set(true);
      variable.set(false);

      expect(triggerCount).toEqual(2);
    });

    test('should notify as usual when it is off', () => {
      let variable = new Variable<boolean>();

      let triggerCount = 0;
      variable.subscribe(() => {
        triggerCount++;
      });

      variable.set(true);
      variable.set(true);
      variable.set(true);
      variable.set(true);
      variable.set(false);

      expect(triggerCount).toEqual(5);
    });
  });

  describe(`Current Value`, () => {
    test('default', () => {
      let variable = new Variable<number>();
      expect(variable.value).not.toBeDefined();
    });

    test('get current value', () => {
      let variable = new Variable<number>();
      variable.set(2);
      expect(variable.value).toEqual(2);
    });

    test('should be set before notification', () => {
      let variable = new Variable<number>();
      variable.subscribe(() => {
        expect(variable.value).toEqual(2);
      });
      variable.set(2);
    });
  });

  describe(`Wait Until`, () => {
    let variable: Variable<SampleModel | undefined>;

    beforeEach(() => {
      variable = new Variable<SampleModel | undefined>();
    });

    test('wait until any change', async () => {
      setTimeout(() => {
        variable.set({ testData: 'sample' });
      }, 1);
      let nextNotification = await variable.waitUntilNext();
      expect(nextNotification).toEqual({ testData: 'sample' });
    });

    test('wait until spesific data', async () => {
      setTimeout(() => {
        variable.set({ testData: 'sample' });
        variable.set({ testData: 'expected' });
      }, 1);
      let nextNotification = await variable.waitUntil({ testData: 'expected' });
      expect(nextNotification).toEqual({ testData: 'expected' });
    });

    test('wait until undefined', async () => {
      setTimeout(() => {
        variable.set({ testData: 'sample' });
        variable.set(undefined);
      }, 1);
      let nextNotification = await variable.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });

    test('wait until spesific data should trigger immidiately if current data is equal', async () => {
      variable.set({ testData: 'expected' });
      let nextNotification = await variable.waitUntil({ testData: 'expected' });
      expect(nextNotification).toEqual({ testData: 'expected' });
    });

    test('wait until undefined should trigger immidiately if current data is equal', async () => {
      let nextNotification = await variable.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });
  });
});
