import { beforeEach, describe, expect, test } from 'vitest';

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
    notifier.subscribe(message => {});
    expect(notifier['listenersMap'].size).toEqual(1);
  });

  test('should be unsubscribable', () => {
    let subscription = notifier.subscribe(message => {});
    subscription.unsubscribe();
    expect(notifier['listenersMap'].size).toEqual(0);
  });

  test('should be combinable', () => {
    let subscription1 = notifier.subscribe(message => {});
    let subscription2 = notifier.subscribe(message => {});
    ActionSubscription.combine([subscription1, subscription2]).unsubscribe();
    expect(notifier['listenersMap'].size).toEqual(0);
  });

  test('should iterate without listeners', () =>
    new Promise<void>(done => {
      notifier.forEach(() => {});
      done();
    }));

  test('should iterate through listeners', () => {
    notifier.subscribe(() => {});
    notifier.subscribe(() => {});

    let count = 0;
    notifier.forEach(listenerCallback => {
      count++;
    });

    expect(count).toEqual(2);
  });

  test('should notify listeners', () =>
    new Promise<void>(done => {
      let listener1 = false;
      let listener2 = false;

      notifier.subscribe(message => {
        if (message === 'sample') {
          listener1 = true;
          if (listener2) {
            done();
          }
        }
      });

      notifier.subscribe(message => {
        if (message === 'sample') {
          listener2 = true;
          if (listener1) {
            done();
          }
        }
      });

      notifier.forEach(listenerCallback => {
        listenerCallback('sample');
      });
    }));

  test('unsubscribe should not take affect until all subscribers being notified', () => {
    let listener1 = false;
    let listener2 = false;

    let subscription1: ActionSubscription;
    let subscription2: ActionSubscription;

    subscription1 = notifier.subscribe(message => {
      listener1 = true;
      subscription2.unsubscribe();
    });

    subscription2 = notifier.subscribe(message => {
      listener2 = true;
      subscription1.unsubscribe();
    });

    notifier.forEach(listenerCallback => {
      listenerCallback('sample');
    });

    expect(listener1).toEqual(true);
    expect(listener2).toEqual(true);
  });
});
