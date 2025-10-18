import { Comparator } from 'helpers-lib';

import { NotificationHelper } from '../../helpers/notification.helper';
import { ActionSubscription } from './action-subscription';
import { NotificationHandler, NotifierCallbackFunction } from './notification-handler';

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
    let subscription = this.notificationHandler.subscribe(data => {
      NotificationHelper.notify(data, callback);
      subscription.destroy();
    });
    return subscription;
  }

  waitUntil(expectedData: T, callback: NotifierCallbackFunction<T>): ActionSubscription {
    let subscription = this.notificationHandler.subscribe(data => {
      if (Comparator.isEqual(data, expectedData)) {
        NotificationHelper.notify(data, callback);
        subscription.destroy();
      }
    });
    return subscription;
  }

  /** @internal */
  get listeners(): NotifierCallbackFunction<T>[] {
    return this.notificationHandler.listeners;
  }
}
