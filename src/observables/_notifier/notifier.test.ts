import { describe, expect, test } from 'vitest';

import { CallbackHelper } from '../../helpers/callback.helper';
import { Notifier } from './notifier';

class SampleModel {
  testData = '';
}

describe('Notifier', () => {
  let triggerNotifierWith = <T>(data: T, notifier: Notifier<T>) => {
    notifier['_listenersMap'].forEach(listener => CallbackHelper._triggerCallback(data, listener));
  };

  test('returns new notifier with same handler', () => {
    let notifier = new Notifier<SampleModel>();
    let notifier2 = notifier.notifier;

    expect(notifier2).toBeInstanceOf(Notifier);
    expect(notifier2).not.toBe(notifier);
    expect(notifier2['_listenersMap']).toBe(notifier['_listenersMap']);
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

  test('subscribe single to a notifier should not break the previous subscription', () => {
    let onCloseAction = new Notifier();
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
