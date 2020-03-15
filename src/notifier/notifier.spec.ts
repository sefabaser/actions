import { Comparator } from 'helpers-lib';

import { Notifier } from './notifier';

class SampleModel {
  testData: string = '';
}

describe(`Notifier`, () => {
  describe(`Basics`, () => {
    let notifier: Notifier<SampleModel>;

    beforeEach(() => {
      notifier = new Notifier<SampleModel>();
    });

    it('should be definable', () => {
      expect(notifier).toBeDefined();
    });

    it('should be subscribable', () => {
      notifier.subscribe(message => {});
      expect(notifier['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    it('should be unsubscribable', () => {
      let subscription = notifier.subscribe(message => {});
      subscription.unsubscribe();
      expect(notifier['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    it('triggerring without listeners', done => {
      notifier.trigger({ testData: 'sample' });
      done();
    });

    it('should notify listeners', done => {
      let listener1 = false;
      let listener2 = false;

      notifier.subscribe(message => {
        if (message && message.testData === 'sample') {
          listener1 = true;
          if (listener2) {
            done();
          }
        }
      });

      notifier.subscribe(message => {
        if (message && message.testData === 'sample') {
          listener2 = true;
          if (listener1) {
            done();
          }
        }
      });

      notifier.trigger({ testData: 'sample' });
    });

    it('should not notify unsubscribed listeners', done => {
      let triggered = false;
      let subscription = notifier.subscribe(message => {
        triggered = true;
      });
      subscription.unsubscribe();
      notifier.trigger({ testData: 'sample' });

      setTimeout(() => {
        if (!triggered) {
          done();
        }
      }, 0);
    });
  });

  describe(`Complex Types`, () => {
    it('should support type: Set', done => {
      let notifier = new Notifier<{ set: Set<string> }>({ persistent: true });
      notifier.trigger({
        set: new Set<string>()
      });
      notifier.subscribe(message => {
        if (message && message.set && Comparator.isSet(message.set)) {
          done();
        }
      });
    });
  });

  describe(`Persistent Notifier`, () => {
    it('persistant', done => {
      let persistentNotifier = new Notifier<boolean>({ persistent: true });
      persistentNotifier.trigger(true);
      persistentNotifier.subscribe(() => {
        done();
      });
    });

    it('not persistant', done => {
      let normalNotifier = new Notifier<void>();
      normalNotifier.trigger();

      let triggered = false;
      normalNotifier.subscribe(() => {
        triggered = true;
      });

      setTimeout(() => {
        if (!triggered) {
          done();
        }
      }, 0);
    });
  });

  describe(`Notify Only On Change Option`, () => {
    it('should notify only on change when it is on', () => {
      let notifier = new Notifier<boolean>({ notifyOnlyOnChange: true });

      let triggerCount = 0;
      notifier.subscribe(() => {
        triggerCount++;
      });

      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(false);

      expect(triggerCount).toEqual(2);
    });

    it('should notify as usual when it is off', () => {
      let notifier = new Notifier<boolean>();

      let triggerCount = 0;
      notifier.subscribe(() => {
        triggerCount++;
      });

      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(true);
      notifier.trigger(false);

      expect(triggerCount).toEqual(5);
    });
  });

  describe(`Current Value`, () => {
    it('default', () => {
      let notifier = new Notifier<number>();
      expect(notifier.currentValue).not.toBeDefined();
    });

    it('get current value', () => {
      let notifier = new Notifier<number>();
      notifier.trigger(2);
      expect(notifier.currentValue).toEqual(2);
    });

    it('should be set before notification', () => {
      let notifier = new Notifier<number>();
      notifier.subscribe(() => {
        expect(notifier.currentValue).toEqual(2);
      });
      notifier.trigger(2);
    });
  });
});
