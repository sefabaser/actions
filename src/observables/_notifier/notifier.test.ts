import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../sequence/sequence';
import { Notifier } from './notifier';

class SampleModel {
  testData = '';
}

describe('Notifier', () => {
  let triggerNotifierWith = <T>(data: T, notifier: Notifier<T>) => {
    notifier['listenersMap'].forEach(listener => CallbackHelper.triggerCallback(data, listener));
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

  describe('Notifier Getter', () => {
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

  describe('For Each', () => {
    let notifier: Notifier<string>;

    beforeEach(() => {
      notifier = new Notifier<string>();
    });

    test('iterate without listeners', () =>
      new Promise<void>(done => {
        notifier.triggerAll('');
        done();
      }));

    test('iterate through listeners', () => {
      let count = 0;

      notifier
        .subscribe(() => {
          count++;
        })
        .attachToRoot();
      notifier
        .subscribe(() => {
          count++;
        })
        .attachToRoot();

      notifier.triggerAll('');

      expect(count).toEqual(2);
    });

    test('notify listeners', () => {
      let heap: string[] = [];

      notifier.subscribe(message => heap.push(message)).attachToRoot();
      notifier.subscribe(message => heap.push(message)).attachToRoot();

      notifier.triggerAll('message');

      expect(heap).toEqual(['message', 'message']);
    });

    test('notifying listeners should follow the subscription order', () => {
      let heap: string[] = [];

      notifier.subscribe(message => heap.push('1' + message)).attachToRoot();
      let secondSubscription = notifier.subscribe(message => heap.push('2' + message)).attachToRoot();
      notifier.subscribe(message => heap.push('3' + message)).attachToRoot();

      secondSubscription.destroy();
      notifier.triggerAll('message');

      expect(heap).toEqual(['1message', '3message']);
    });

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

      notifier.triggerAll('sample');

      expect(listener1).toEqual(true);
      expect(listener2).toEqual(true);
    });
  });

  describe('Attached Parent', () => {
    test('should destroy the subscription when it is destroyed', () => {
      let notifier = new Notifier<string>();
      let parent = new Attachable().attachToRoot();
      let subscription = notifier.subscribe(_ => {}).attach(parent);
      expect(subscription.destroyed).toEqual(false);
      parent.destroy();
      expect(subscription.destroyed).toEqual(true);
    });
  });

  describe('To Sequence', () => {
    test('convert to sequence', () => {
      let notifier = new Notifier<string>();
      let sequence = notifier.toSequence().attachToRoot();
      expect(sequence).toBeInstanceOf(Sequence);
    });

    test('triggering notifier should trigger sequence', () => {
      let notifier = new Notifier<void>();

      let triggered = false;
      notifier
        .toSequence()
        .read(() => {})
        .read(() => (triggered = true))
        .attachToRoot();

      notifier.triggerAll();
      expect(triggered).toEqual(true);
    });

    test('destroying sequence should remove the listener', () => {
      let notifier = new Notifier<void>();
      let sequence = notifier.toSequence().attachToRoot();
      expect(notifier.listenerCount).toEqual(1);
      sequence.destroy();
      expect(notifier.listenerCount).toEqual(0);
    });
  });

  describe('Create From Sqeuence', () => {
    test('setup', () => {
      let sequence = Sequence.create<string>(() => {});
      let notifier = Notifier.fromSequence(sequence).attachToRoot();
      expect(notifier.listenerCount).toEqual(0);
    });

    test('converting notifier before attaching should throw error', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence = Sequence.create<string>(() => {}).attachToRoot();
        Notifier.fromSequence(sequence);

        vi.runAllTimers();
      }).toThrow('Attached sequences cannot be converted to notifier!');
    });

    test('converted notifier can be subscribed by many', () => {
      let sequence = Sequence.create<string>(resolve => resolve('a'));
      let notifier = Notifier.fromSequence(sequence).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      expect(notifier.listenerCount).toEqual(2);
    });

    test('destroyed attached parent of the sequence, should destroy subscriptions', () => {
      let externalNotifier = new Notifier<string>();

      let parent = new Attachable().attachToRoot();
      let sequence = Sequence.create(resolve => resolve()).orderedMap(() => externalNotifier);
      Notifier.fromSequence(sequence).attach(parent);

      expect(externalNotifier.listenerCount).toEqual(1);
      parent.destroy();
      expect(externalNotifier.listenerCount).toEqual(0);
    });
  });
});
