import { Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from './notification-handler';

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
  get listenerCount(): number {
    return this.notificationHandler.listenerCount;
  }

  get notifier(): Notifier<T> {
    return new Notifier<T>(this.notificationHandler);
  }

  protected notificationHandler: NotificationHandler<T>;

  constructor(notificationHandler: NotificationHandler<T> = new NotificationHandler<T>()) {
    this.notificationHandler = notificationHandler;
  }

  subscribe(callback: NotifierCallbackFunction<T>): ActionSubscription {
    return this.notificationHandler.subscribe(callback);
  }

  waitUntilNext(callback: NotifierCallbackFunction<T>): ActionSubscription {
    let subscription = this.subscribe(data => {
      this.notify(data, callback);
      subscription.destroy();
    });
    return subscription;
  }

  waitUntil(expectedData: T, callback: NotifierCallbackFunction<T>): ActionSubscription {
    let subscription = this.subscribe(data => {
      if (Comparator.isEqual(data, expectedData)) {
        console.log('before notify', data, callback);
        this.notify(data, callback);
        subscription.destroy();
      }
    });
    return subscription;
  }

  protected notify(data: T, callback: NotifierCallbackFunction<T>): void {
    try {
      callback(data);
    } catch (e) {
      console.error('Notifier callback function error: ', e);
    }
  }
}
