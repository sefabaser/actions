import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { NotifierBase } from './notifier-base';

class SampleModel {
  testData = '';
}

describe('NotifierBase', () => {
  let triggerNotifierWith = <T>(data: T, notifier: NotifierBase<T>) => {
    notifier['_listenersMap'].forEach(listener => CallbackHelper._triggerCallback(data, listener));
  };

  describe('Basics', () => {
    let notifier: NotifierBase<SampleModel>;

    beforeEach(() => {
      notifier = new NotifierBase<SampleModel>();
    });

    test('definable', () => {
      expect(notifier).toBeDefined();
    });

    test('subscribable', () => {
      notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier['_listenersMap'].size).toEqual(1);
    });

    test('subscription destroyable', () => {
      let subscription = notifier.subscribe(_ => {}).attachToRoot();
      subscription.destroy();
      expect(notifier['_listenersMap'].size).toEqual(0);
    });

    test('trigger listeners', () => {
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

    test('read single', () => {
      let listenerTriggeredWith: any;

      let subscription = notifier
        ._subscribeSingle(message => {
          listenerTriggeredWith = message;
        })
        .attachToRoot();

      expect(subscription.destroyed).toBeFalsy();
      expect(listenerTriggeredWith).toEqual(undefined);

      triggerNotifierWith({ testData: 'sample' }, notifier);
      expect(subscription.destroyed).toBeTruthy();
      expect(listenerTriggeredWith).toEqual({ testData: 'sample' });
    });
  });

  describe('For Each', () => {
    let notifier: NotifierBase<string>;

    beforeEach(() => {
      notifier = new NotifierBase<string>();
    });

    test('iterate without listeners', () =>
      new Promise<void>(done => {
        notifier._triggerAll('');
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

      notifier._triggerAll('');

      expect(count).toEqual(2);
    });

    test('notify listeners', () => {
      let heap: string[] = [];

      notifier.subscribe(message => heap.push(message)).attachToRoot();
      notifier.subscribe(message => heap.push(message)).attachToRoot();

      notifier._triggerAll('message');

      expect(heap).toEqual(['message', 'message']);
    });

    test('notifying listeners should follow the subscription order', () => {
      let heap: string[] = [];

      notifier.subscribe(message => heap.push('1' + message)).attachToRoot();
      let secondSubscription = notifier.subscribe(message => heap.push('2' + message)).attachToRoot();
      notifier.subscribe(message => heap.push('3' + message)).attachToRoot();

      secondSubscription.destroy();
      notifier._triggerAll('message');

      expect(heap).toEqual(['1message', '3message']);
    });
  });

  describe('Attached Parent', () => {
    test('should destroy the subscription when it is destroyed', () => {
      let notifier = new NotifierBase<string>();
      let parent = new Attachable().attachToRoot();
      let subscription = notifier.subscribe(_ => {}).attach(parent);
      expect(subscription.destroyed).toEqual(false);
      parent.destroy();
      expect(subscription.destroyed).toEqual(true);
    });
  });

  describe('Clear', () => {
    test('listener count', () => {
      let notifier = new NotifierBase<SampleModel>();

      expect(notifier.listenerCount).toBe(0);

      let sub1 = notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier.listenerCount).toBe(1);

      notifier.subscribe(_ => {}).attachToRoot();
      expect(notifier.listenerCount).toBe(2);

      sub1.destroy();
      expect(notifier.listenerCount).toBe(1);

      notifier.clear();
      expect(notifier.listenerCount).toBe(0);
    });
  });

  describe('To Sequence', () => {
    test('convert to sequence', () => {
      let notifier = new NotifierBase<string>();
      let sequence = notifier.toSequence().attachToRoot();
      expect(sequence).toBeInstanceOf(Sequence);
    });

    test('triggering notifier should trigger sequence', () => {
      let notifier = new NotifierBase<void>();

      let triggered = false;
      notifier
        .toSequence()
        .tap(() => {})
        .tap(() => (triggered = true))
        .attachToRoot();

      notifier._triggerAll();
      expect(triggered).toEqual(true);
    });

    test('destroying sequence should remove the listener', () => {
      let notifier = new NotifierBase<void>();
      let sequence = notifier.toSequence().attachToRoot();
      expect(notifier.listenerCount).toEqual(1);
      sequence.destroy();
      expect(notifier.listenerCount).toEqual(0);
    });
  });

  describe('To Single Event', () => {
    test('convert to single event', () => {
      let notifier = new NotifierBase<string>();
      let singleEvent = notifier.toSingleEvent().attachToRoot();
      expect(singleEvent).toBeInstanceOf(SingleEvent);
    });

    test('triggering notifier should trigger single event', () => {
      let notifier = new NotifierBase<void>();

      let triggered = false;
      notifier
        .toSingleEvent()
        .tap(() => {})
        .tap(() => (triggered = true))
        .attachToRoot();

      notifier._triggerAll();
      expect(triggered).toEqual(true);
    });

    test('destroying single event should remove the listener', () => {
      let notifier = new NotifierBase<void>();
      let singleEvent = notifier.toSingleEvent().attachToRoot();
      expect(notifier.listenerCount).toEqual(1);
      singleEvent.destroy();
      expect(notifier.listenerCount).toEqual(0);
    });

    test('the completion of the single event should remove the listener', () => {
      let notifier = new NotifierBase<void>();
      notifier.toSingleEvent().attachToRoot();
      expect(notifier.listenerCount).toEqual(1);
      notifier._triggerAll();
      expect(notifier.listenerCount).toEqual(0);
    });
  });

  describe('Create From Sqeuence', () => {
    test('setup', () => {
      let sequence = Sequence.create<string>(() => {});
      let notifier = NotifierBase.fromSequence(sequence).attachToRoot();
      expect(notifier.listenerCount).toEqual(0);
    });

    test('converting notifier before attaching should throw error', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence = Sequence.create<string>(() => {}).attachToRoot();
        NotifierBase.fromSequence(sequence);

        vi.runAllTimers();
      }).toThrow('Attached sequences cannot be converted to notifier!');
    });

    test('converted notifier can be subscribed by many', () => {
      let sequence = Sequence.create<string>(resolve => resolve('a'));
      let notifier = NotifierBase.fromSequence(sequence).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      expect(notifier.listenerCount).toEqual(2);
    });

    test('destroyed attached parent of the sequence, should destroy subscriptions', () => {
      let externalNotifier = new NotifierBase<string>();

      let parent = new Attachable().attachToRoot();
      let sequence = Sequence.create(resolve => resolve()).asyncMapOrdered(() => externalNotifier);
      NotifierBase.fromSequence(sequence).attach(parent);

      expect(externalNotifier.listenerCount).toEqual(1);
      parent.destroy();
      expect(externalNotifier.listenerCount).toEqual(0);
    });
  });

  describe('Edge Cases', () => {
    test(`Race condition, sequences destroying another sequences' parent`, () => {
      let notifier = new NotifierBase();

      class Foo extends Attachable {
        foo = { x: 1 };

        destroy(): void {
          super.destroy();
          this.foo = undefined as any;
        }
      }

      let parent = new Foo().attachToRoot();
      let triggered1 = false;
      let triggered2 = false;

      notifier
        .subscribe(() => {
          triggered1 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      notifier
        .subscribe(() => {
          triggered2 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      expect(() => notifier._triggerAll()).not.throw();
      expect(triggered1).toBeTruthy();
      expect(triggered2).toBeFalsy();
    });

    test('One subscription that is added by another subscription on trigger, should not be called right away', () => {
      let notifier = new NotifierBase();

      let called = false;
      notifier
        .subscribe(() => {
          notifier
            .subscribe(() => {
              called = true;
            })
            .attachToRoot();
        })
        .attachToRoot();

      notifier._triggerAll();
      expect(called).toBeFalsy();
    });
  });
});
