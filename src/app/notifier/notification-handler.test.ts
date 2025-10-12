import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionSubscription, NotificationHandler } from './notification-handler';

describe(`Notification Handler`, () => {
  let notifier: NotificationHandler<string>;

  beforeEach(() => {
    notifier = new NotificationHandler<string>();
  });

  test('should be definable', () => {
    expect(notifier).toBeDefined();
  });

  test('should be subscribable', () => {
    notifier.subscribe(_ => {}).attachToRoot();
    expect(notifier['listenersMap'].size).toEqual(1);
  });

  test('should be unsubscribable', () => {
    let subscription = notifier.subscribe(_ => {}).attachToRoot();
    subscription.destroy();
    expect(notifier['listenersMap'].size).toEqual(0);
  });

  test('attached parent should destroy the subscription when it is destroyed', () => {
    let parent = new Attachable().attachToRoot();
    let subscription = notifier.subscribe(_ => {}).attach(parent);
    expect(subscription.destroyed).toEqual(false);
    parent.destroy();
    expect(subscription.destroyed).toEqual(true);
  });

  test('should be combinable', () => {
    let subscription1 = notifier.subscribe(_ => {}).attachToRoot();
    let subscription2 = notifier.subscribe(_ => {}).attachToRoot();
    ActionSubscription.combine([subscription1, subscription2]).attachToRoot().destroy();
    expect(notifier['listenersMap'].size).toEqual(0);
  });

  test('should iterate without listeners', () =>
    new Promise<void>(done => {
      notifier.forEach(() => {});
      done();
    }));

  test('should iterate through listeners', () => {
    notifier.subscribe(() => {}).attachToRoot();
    notifier.subscribe(() => {}).attachToRoot();

    let count = 0;
    notifier.forEach(_ => {
      count++;
    });

    expect(count).toEqual(2);
  });

  test('should notify listeners', () =>
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

    let subscription1: ActionSubscription;
    let subscription2: ActionSubscription;

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
