import { describe, expect, test } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { SingleEvent } from '../../stream/single-event/single-event';
import { SingleNotifier } from './single-notifier';

class SampleModel {
  testData = '';
}

describe('SingleNotifier', () => {
  describe('Basic', () => {
    let triggerNotifierWith = <T>(data: T, notifier: SingleNotifier<T>) => {
      notifier['_listenersMap'].forEach(listener => CallbackHelper._triggerCallback(data, listener));
    };

    test('returns new notifier with same handler', () => {
      let notifier = new SingleNotifier<SampleModel>();
      let notifier2 = notifier.notifier;

      expect(notifier2).toBeInstanceOf(SingleNotifier);
      expect(notifier2).not.toBe(notifier);
      expect(notifier2['_listenersMap']).toBe(notifier['_listenersMap']);
    });

    test('subscriptions are shared between notifiers', () => {
      let notifier = new SingleNotifier<SampleModel>();
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
      let notifier = new SingleNotifier<SampleModel>();
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

    test('subscribe single to a notifier should not break the previous subscription', () => {
      let onCloseAction = new SingleNotifier();
      let onClose = onCloseAction.notifier;

      let onCloseCalled = false;
      onCloseAction
        .subscribe(() => {
          onCloseCalled = true;
        })
        .attachToRoot();

      onClose._subscribeSingle(() => {}).attachToRoot();

      onCloseAction._triggerAll();

      expect(onCloseCalled).toBeTruthy();
    });
  });

  describe('Create From SingleEvent', () => {
    test('setup', () => {
      let singleEvent = SingleEvent.create<string>(() => {});
      let notifier = SingleNotifier.fromSingleEvent(singleEvent).attachToRoot();
      expect(notifier.listenerCount).toEqual(0);
    });

    test('converting event after attaching should throw error', () => {
      expect(() => {
        let singleEvent = SingleEvent.create<string>(() => {}).attachToRoot();
        SingleNotifier.fromSingleEvent(singleEvent);
      }).toThrow('Attached sequences cannot be converted to notifier!');
    });

    test('converted notifier can be subscribed by many', () => {
      let singleEvent = SingleEvent.create<string>(resolve => resolve('a'));
      let notifier = SingleNotifier.fromSingleEvent(singleEvent).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      expect(notifier.listenerCount).toEqual(2);
    });

    test('destroyed attached parent of the single event, should destroy subscriptions', () => {
      let externalNotifier = new SingleNotifier<string>();

      let parent = new Attachable().attachToRoot();
      let singleEvent = SingleEvent.create(resolve => resolve()).asyncMap(() => externalNotifier);
      SingleNotifier.fromSingleEvent(singleEvent).attach(parent);

      expect(externalNotifier.listenerCount).toEqual(1);
      parent.destroy();
      expect(externalNotifier.listenerCount).toEqual(0);
    });
  });
});
