import { Comparator } from 'helpers-lib';

import { Variable } from './variable';

class SampleModel {
  testData: string = '';
}

describe(`Variable`, () => {
  describe(`Basics`, () => {
    let variable: Variable<SampleModel>;

    beforeEach(() => {
      variable = new Variable<SampleModel>();
    });

    it('should be definable', () => {
      expect(variable).toBeDefined();
    });

    it('should be subscribable', () => {
      variable.subscribe(message => {});
      expect(variable['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    it('should be unsubscribable', () => {
      let subscription = variable.subscribe(message => {});
      subscription.unsubscribe();
      expect(variable['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    it('triggerring without listeners', done => {
      variable.trigger({ testData: 'sample' });
      done();
    });

    it('should notify listeners', done => {
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

      variable.trigger({ testData: 'sample' });
    });

    it('should not notify unsubscribed listeners', done => {
      let triggered = false;
      let subscription = variable.subscribe(message => {
        triggered = true;
      });
      subscription.unsubscribe();
      variable.trigger({ testData: 'sample' });

      setTimeout(() => {
        if (!triggered) {
          done();
        }
      }, 0);
    });
  });

  describe(`Complex Types`, () => {
    it('should support type: Set', done => {
      let variable = new Variable<{ set: Set<string> }>();
      variable.trigger({
        set: new Set<string>()
      });
      variable.subscribe(message => {
        if (message && message.set && Comparator.isSet(message.set)) {
          done();
        }
      });
    });
  });

  describe(`Persistency`, () => {
    it('persistent', done => {
      let persistentVariable = new Variable<boolean>();
      persistentVariable.trigger(true);
      persistentVariable.subscribe(() => {
        done();
      });
    });
  });

  describe(`Notify Only On Change Option`, () => {
    it('should notify only on change when it is on', () => {
      let variable = new Variable<boolean>({ notifyOnChange: true });

      let triggerCount = 0;
      variable.subscribe(() => {
        triggerCount++;
      });

      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(false);

      expect(triggerCount).toEqual(2);
    });

    it('should notify as usual when it is off', () => {
      let variable = new Variable<boolean>();

      let triggerCount = 0;
      variable.subscribe(() => {
        triggerCount++;
      });

      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(true);
      variable.trigger(false);

      expect(triggerCount).toEqual(5);
    });
  });

  describe(`Current Value`, () => {
    it('default', () => {
      let variable = new Variable<number>();
      expect(variable.currentValue).not.toBeDefined();
    });

    it('get current value', () => {
      let variable = new Variable<number>();
      variable.trigger(2);
      expect(variable.currentValue).toEqual(2);
    });

    it('should be set before notification', () => {
      let variable = new Variable<number>();
      variable.subscribe(() => {
        expect(variable.currentValue).toEqual(2);
      });
      variable.trigger(2);
    });
  });

  describe(`Wait Until`, () => {
    let action: Variable<SampleModel | undefined>;

    beforeEach(() => {
      action = new Variable<SampleModel | undefined>();
    });

    it('wait until any change', async () => {
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
      }, 1);
      let nextNotification = await action.next();
      expect(nextNotification).toEqual({ testData: 'sample' });
    });

    it('wait until spesific data', async () => {
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
        action.trigger({ testData: 'expected' });
      }, 1);
      let nextNotification = await action.waitUntil({ testData: 'expected' });
      expect(nextNotification).toEqual({ testData: 'expected' });
    });

    it('wait until undefined', async () => {
      setTimeout(() => {
        action.trigger({ testData: 'sample' });
        action.trigger(undefined);
      }, 1);
      let nextNotification = await action.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });

    it('wait until spesific data should trigger immidiately if current data is equal', async () => {
      action.trigger({ testData: 'expected' });
      let nextNotification = await action.waitUntil({ testData: 'expected' });
      expect(nextNotification).toEqual({ testData: 'expected' });
    });

    it('wait until undefined should trigger immidiately if current data is equal', async () => {
      let nextNotification = await action.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });
  });

  describe(`Destroy`, () => {
    it('should destroy', () => {
      let action = new Variable<void>();
      action.subscribe(() => {});

      action.destroy();
      expect(action['notificationHandler']['listenersMap'].size).toEqual(0);
      expect(action['nextListeners'].size).toEqual(0);
      expect(action['untilListeners'].size).toEqual(0);
    });

    it('should be non-operational after destroy', () => {
      let action = new Variable<void>();
      action.destroy();

      expect(() => {
        action.trigger();
      }).toThrow();

      expect(() => {
        action.subscribe(() => {});
      }).toThrow();

      expect(() => {
        action.next();
      }).toThrow();

      expect(() => {
        action.waitUntil();
      }).toThrow();
    });
  });
});
