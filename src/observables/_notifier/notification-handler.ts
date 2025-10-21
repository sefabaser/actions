import { IAttachable } from '../../attachable/attachable';
import { NotificationHelper } from '../../helpers/notification.helper';
import { Stream, StreamTouchFunction } from '../../stream/stream';
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
    let subscriptionId = this.getNextAvailableSubscriptionId();
    this.listenersMap.set(subscriptionId, callback);

    return new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });
  }

  // TODO: unit tests
  toStream(): Stream<T> {
    let subscriptionId = this.getNextAvailableSubscriptionId();
    return new Stream<T>(
      resolve => {
        this.listenersMap.set(subscriptionId, resolve);
      },
      () => {
        this.listenersMap.delete(subscriptionId);
      }
    );
  }

  // TODO: unit tests
  tap<K>(callback: StreamTouchFunction<T, K>): Stream<K> {
    return this.toStream().tap(callback);
  }

  /** @internal */
  get listeners(): NotifierCallbackFunction<T>[] {
    return [...this.listenersMap.values()];
  }

  private getNextAvailableSubscriptionId(): number {
    return this.nextAvailableSubscriptionId++;
  }
}
