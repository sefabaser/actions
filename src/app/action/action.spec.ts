import { Comparator } from 'helpers-lib';

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

    it('should be definable', () => {
      expect(action).toBeDefined();
    });

    it('should be subscribable', () => {
      action.subscribe(message => {});
      expect(action['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    it('should be unsubscribable', () => {
      let subscription = action.subscribe(message => {});
      subscription.unsubscribe();
      expect(action['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    it('triggerring without listeners', done => {
      action.trigger({ testData: 'sample' });
      done();
    });

    it('should notify listeners', done => {
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
    });

    it('should not notify unsubscribed listeners', done => {
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
    });
  });

  describe(`Complex Types`, () => {
    it('should support type: Set', done => {
      let action = new Action<{ set: Set<string> }>();
      action.subscribe(message => {
        if (message && message.set && Comparator.isSet(message.set)) {
          done();
        }
      });
      action.trigger({
        set: new Set<string>()
      });
    });

    it('not persistant', done => {
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
    });
  });

  describe(`Wait Until`, () => {
    let action: Action<SampleModel | undefined>;

    beforeEach(() => {
      action = new Action<SampleModel | undefined>();
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
        action.trigger({ testData: 'expected' });
      }, 1);
      let nextNotification = await action.waitUntil(undefined);
      expect(nextNotification).toBeUndefined();
    });
  });

  fdescribe(`Destroy`, () => {
    it('should destroy', () => {
      let action = new Action<void>();
      action.subscribe(() => {});

      action.destroy();
      expect(action['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    it('should be non-operational after destroy', () => {
      let action = new Action<void>();
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
