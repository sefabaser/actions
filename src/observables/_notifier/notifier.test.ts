import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Notifier } from './notifier';

class SampleModel {
  testData = '';
}

describe('Notifier', () => {
  let triggerNotifierWith = <T>(data: T, notifier: Notifier<T>) => {
    notifier.listeners.forEach(listener => CallbackHelper.triggerCallback(data, listener));
  };

  describe('Basics', () => {
    let notifier: Notifier<SampleModel>;

    beforeEach(() => {
      notifier = new Notifier<SampleModel>();
    });

    test('definable', () => {
      expect(notifier).toBeDefined();
    });

    test('subscribable', () => {
      notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier['listenersMap'].size).toEqual(1);
    });

    test('subscription destroyable', () => {
      let subscription = notifier.subscribe(_ => {}).attachToRoot();
      subscription.destroy();
      expect(notifier['listenersMap'].size).toEqual(0);
    });

    test('loop through listeners', () => {
      let listener1TriggeredWith: any;
      let listener2TriggeredWith: any;

      notifier
        .subscribe(message => {
          listener1TriggeredWith = message;
        })
        .attachToRoot();

      notifier
        .subscribe(message => {
          listener2TriggeredWith = message;
        })
        .attachToRoot();

      triggerNotifierWith({ testData: 'sample' }, notifier);

      expect(listener1TriggeredWith).toEqual({ testData: 'sample' });
      expect(listener2TriggeredWith).toEqual({ testData: 'sample' });
    });

    test('not notify destroyed listeners', () => {
      let triggered = false;
      let subscription = notifier
        .subscribe(_ => {
          triggered = true;
        })
        .attachToRoot();
      subscription.destroy();

      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(triggered).toBe(false);
    });

    test('listener count', () => {
      expect(notifier.listenerCount).toBe(0);

      let sub1 = notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier.listenerCount).toBe(1);

      let sub2 = notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier.listenerCount).toBe(2);

      sub1.destroy();
      expect(notifier.listenerCount).toBe(1);

      sub2.destroy();
      expect(notifier.listenerCount).toBe(0);
    });

    test('callback error handling', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let subscription2Called = false;

      notifier
        .subscribe(_ => {
          throw new Error('Test error');
        })
        .attachToRoot();

      notifier
        .subscribe(_ => {
          subscription2Called = true;
        })
        .attachToRoot();

      triggerNotifierWith({ testData: 'sample' }, notifier);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', expect.any(Error));
      expect(subscription2Called).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Wait Until', () => {
    let notifier: Notifier<SampleModel | undefined>;

    beforeEach(() => {
      notifier = new Notifier<SampleModel | undefined>();
    });

    test('wait until next', () => {
      let resolvedWith: SampleModel | undefined;

      notifier
        .waitUntilNext(state => {
          resolvedWith = state;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(resolvedWith).toEqual({ testData: 'sample' });
    });

    test('wait until spesific data', () => {
      let resolvedWith: SampleModel | undefined;

      notifier
        .waitUntil({ testData: 'expected' }, state => {
          resolvedWith = state;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(resolvedWith).toBeUndefined();
      triggerNotifierWith({ testData: 'expected' }, notifier);
      expect(resolvedWith).toEqual({ testData: 'expected' });
    });

    test('wait until undefined', () => {
      let resolvedWith: SampleModel | undefined;
      let resolved = false;

      notifier
        .waitUntil(undefined, state => {
          resolvedWith = state;
          resolved = true;
        })
        .attachToRoot();

      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);

      triggerNotifierWith(undefined, notifier);
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(true);
    });

    test('wait until next not triggered if subscription is destroyed', () => {
      let resolvedWith: SampleModel | undefined;
      let resolved = false;

      let subscription = notifier
        .waitUntilNext(state => {
          resolvedWith = state;
          resolved = true;
        })
        .attachToRoot();

      subscription.destroy();

      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);
    });

    test('wait until spesific data not triggered if subscription is destroyed', () => {
      let resolvedWith: SampleModel | undefined;
      let resolved = false;

      let subscription = notifier
        .waitUntil(undefined, state => {
          resolvedWith = state;
          resolved = true;
        })
        .attachToRoot();

      subscription.destroy();
      notifier.forEach(listener => listener(undefined));

      expect(resolvedWith).toBeUndefined();
      expect(resolved).toBe(false);
    });

    test('wait until next auto-unsubscribes after first trigger', () => {
      let callCount = 0;

      notifier
        .waitUntilNext(_ => {
          callCount++;
        })
        .attachToRoot();

      expect(notifier.listenerCount).toBe(1);
      notifier.forEach(listener => listener({ testData: 'first' }));
      expect(callCount).toBe(1);
      expect(notifier.listenerCount).toBe(0);

      notifier.forEach(listener => listener({ testData: 'second' }));
      expect(callCount).toBe(1);
    });

    test('wait until auto-unsubscribes after matching data', () => {
      let callCount = 0;

      notifier
        .waitUntil({ testData: 'expected' }, _ => {
          callCount++;
        })
        .attachToRoot();

      expect(notifier.listenerCount).toBe(1);
      notifier.forEach(listener => listener({ testData: 'wrong' }));
      expect(callCount).toBe(0);
      expect(notifier.listenerCount).toBe(1);

      notifier.forEach(listener => listener({ testData: 'expected' }));
      expect(callCount).toBe(1);
      expect(notifier.listenerCount).toBe(0);

      notifier.forEach(listener => listener({ testData: 'expected' }));
      expect(callCount).toBe(1);
    });

    test('wait until next handles callback errors', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      notifier
        .waitUntilNext(_ => {
          throw new Error('Test error');
        })
        .attachToRoot();

      triggerNotifierWith({ testData: 'sample' }, notifier);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    test('wait until handles callback errors', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      notifier
        .waitUntil({ testData: 'expected' }, _ => {
          throw new Error('Test error');
        })
        .attachToRoot();

      notifier.forEach(listener => listener({ testData: 'expected' }));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Notifier getter', () => {
    test('returns new notifier with same handler', () => {
      let notifier = new Notifier<SampleModel>();
      let notifier2 = notifier.notifier;

      expect(notifier2).toBeInstanceOf(Notifier);
      expect(notifier2).not.toBe(notifier);
      expect(notifier2['listenersMap']).toBe(notifier['listenersMap']);
    });

    test('subscriptions are shared between notifiers', () => {
      let notifier = new Notifier<SampleModel>();
      let notifier2 = notifier.notifier;

      let called1 = false;
      let called2 = false;

      notifier
        .subscribe(_ => {
          called1 = true;
        })
        .attachToRoot();

      notifier2
        .subscribe(_ => {
          called2 = true;
        })
        .attachToRoot();

      triggerNotifierWith({ testData: 'sample' }, notifier);

      expect(called1).toBe(true);
      expect(called2).toBe(true);
      expect(notifier.listenerCount).toBe(2);
      expect(notifier2.listenerCount).toBe(2);
    });

    test('destroying subscription of one notifier should effect the other notifier', () => {
      let notifier = new Notifier<SampleModel>();
      let notifier2 = notifier.notifier;

      let called = false;

      let subscription = notifier2
        .subscribe(_ => {
          called = true;
        })
        .attachToRoot();

      expect(notifier.listenerCount).toBe(1);
      expect(notifier2.listenerCount).toBe(1);

      subscription.destroy();

      triggerNotifierWith({ testData: 'sample' }, notifier);

      expect(called).toBe(false);
    });
  });

  describe('forEach', () => {
    let notifier: Notifier<string>;

    beforeEach(() => {
      notifier = new Notifier<string>();
    });

    test('iterate without listeners', () =>
      new Promise<void>(done => {
        notifier.forEach(() => {});
        done();
      }));

    test('iterate through listeners', () => {
      notifier.subscribe(() => {}).attachToRoot();
      notifier.subscribe(() => {}).attachToRoot();

      let count = 0;
      notifier.forEach(_ => {
        count++;
      });

      expect(count).toEqual(2);
    });

    test('notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        notifier
          .subscribe(message => {
            if (message === 'sample') {
              listener1 = true;
              if (listener2) {
                done();
              }
            }
          })
          .attachToRoot();

        notifier
          .subscribe(message => {
            if (message === 'sample') {
              listener2 = true;
              if (listener1) {
                done();
              }
            }
          })
          .attachToRoot();

        notifier.forEach(listenerCallback => {
          listenerCallback('sample');
        });
      }));

    test('destroy should not take affect until all subscribers being notified', () => {
      let listener1 = false;
      let listener2 = false;

      let subscription1: any;
      let subscription2: any;

      subscription1 = notifier
        .subscribe(_ => {
          listener1 = true;
          subscription2.destroy();
        })
        .attachToRoot();

      subscription2 = notifier
        .subscribe(_ => {
          listener2 = true;
          subscription1.destroy();
        })
        .attachToRoot();

      notifier.forEach(listenerCallback => {
        listenerCallback('sample');
      });

      expect(listener1).toEqual(true);
      expect(listener2).toEqual(true);
    });
  });

  describe('attached parent', () => {
    test('should destroy the subscription when it is destroyed', () => {
      let notifier = new Notifier<string>();
      let parent = new Attachable().attachToRoot();
      let subscription = notifier.subscribe(_ => {}).attach(parent);
      expect(subscription.destroyed).toEqual(false);
      parent.destroy();
      expect(subscription.destroyed).toEqual(true);
    });
  });
});
