import { IAttachable } from '../../attachable/attachable';
import { NotificationHelper } from '../../helpers/notification.helper';
import { ActionSubscription } from './action-subscription';

export type NotifierCallbackFunction<T> = (data: T) => void;

/** @internal */
export class NotificationHandler<T> {
  private listenersMap = new Map<number, NotifierCallbackFunction<T>>();
  private nextAvailableSubscriptionId = 1;

  get listenerCount(): number {
    return this.listenersMap.size;
  }

  forEach(callback: (listenerCallbackFunction: NotifierCallbackFunction<T>) => void): NotificationHandler<T> {
    let newMap = new Map<number, NotifierCallbackFunction<T>>(this.listenersMap);
    newMap.forEach(data => NotificationHelper.notify(data, callback));
    return this;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    let subscriptionId = this.nextAvailableSubscriptionId;
    this.listenersMap.set(subscriptionId, callback);
    this.nextAvailableSubscriptionId++;

    return new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });
  }

  /** @internal */
  get listeners(): NotifierCallbackFunction<T>[] {
    return [...this.listenersMap.values()];
  }
}
