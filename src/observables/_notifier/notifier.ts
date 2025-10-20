import { Comparator } from 'helpers-lib';

import { IAttachable } from '../../attachable/attachable';
import { NotificationHelper } from '../../helpers/notification.helper';
import { NotificationHandler, NotifierCallbackFunction } from './notification-handler';

export class Notifier<T> {
  get listenerCount(): number {
    return this.notificationHandler.listenerCount;
  }

  get notifier(): Notifier<T> {
    let wrapper = new Notifier<T>(this.notificationHandler);
    wrapper.subscribe = callback => this.subscribe(callback);
    wrapper.waitUntil = (expectedData, callback) => this.waitUntil(expectedData, callback);
    wrapper.waitUntilNext = callback => this.waitUntilNext(callback);
    return wrapper;
  }

  protected notificationHandler: NotificationHandler<T>;

  constructor(notificationHandler: NotificationHandler<T> = new NotificationHandler<T>()) {
    this.notificationHandler = notificationHandler;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    return this.notificationHandler.subscribe(callback);
  }

  waitUntilNext(callback: NotifierCallbackFunction<T>): IAttachable {
    let subscription = this.notificationHandler.subscribe(data => {
      NotificationHelper.notify(data, callback);
      subscription.destroy();
    });
    return subscription;
  }

  waitUntil(expectedData: T, callback: NotifierCallbackFunction<T>): IAttachable {
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
