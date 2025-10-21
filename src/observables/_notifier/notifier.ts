import { Comparator } from 'helpers-lib';

import { IAttachable } from '../../attachable/attachable';
import { NotificationHelper } from '../../helpers/notification.helper';
import { Stream, StreamTouchFunction } from '../../stream/stream';
import { ActionSubscription } from './action-subscription';

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
  private listenersMap = new Map<number, NotifierCallbackFunction<T>>();
  private nextAvailableSubscriptionId = 1;

  get listenerCount(): number {
    return this.listenersMap.size;
  }

  get notifier(): Notifier<T> {
    let wrapper = new Notifier<T>();
    wrapper.listenersMap = this.listenersMap;
    wrapper.nextAvailableSubscriptionId = this.nextAvailableSubscriptionId;
    wrapper.subscribe = callback => this.subscribe(callback);
    wrapper.waitUntil = (expectedData, callback) => this.waitUntil(expectedData, callback);
    wrapper.waitUntilNext = callback => this.waitUntilNext(callback);
    return wrapper;
  }

  forEach(callback: (listenerCallbackFunction: NotifierCallbackFunction<T>) => void): Notifier<T> {
    let newMap = new Map<number, NotifierCallbackFunction<T>>(this.listenersMap);
    newMap.forEach(data => NotificationHelper.notify(data, callback));
    return this;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    return this.baseSubscribe(callback);
  }

  waitUntilNext(callback: NotifierCallbackFunction<T>): IAttachable {
    let subscription: IAttachable;
    subscription = this.baseSubscribe(data => {
      NotificationHelper.notify(data, callback);
      subscription.destroy();
    });
    return subscription;
  }

  waitUntil(expectedData: T, callback: NotifierCallbackFunction<T>): IAttachable {
    let subscription: IAttachable;
    subscription = this.baseSubscribe(data => {
      if (Comparator.isEqual(data, expectedData)) {
        NotificationHelper.notify(data, callback);
        subscription.destroy();
      }
    });
    return subscription;
  }

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

  private baseSubscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    let subscriptionId = this.getNextAvailableSubscriptionId();
    this.listenersMap.set(subscriptionId, callback);

    return new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });
  }
}
