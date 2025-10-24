import { Comparator } from 'helpers-lib';

import { IAttachable } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Stream2, StreamTouchFunction } from '../../stream/stream';
import { ActionSubscription } from '../../utilities/action-subscription';

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
    newMap.forEach(data => CallbackHelper.triggerCallback(data, callback));
    return this;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    return this.baseSubscribe(callback);
  }

  waitUntilNext(callback: NotifierCallbackFunction<T>): IAttachable {
    let subscription: IAttachable;
    subscription = this.baseSubscribe(data => {
      CallbackHelper.triggerCallback(data, callback);
      subscription.destroy();
    });
    return subscription;
  }

  waitUntil(expectedData: T, callback: NotifierCallbackFunction<T>): IAttachable {
    let subscription: IAttachable;
    subscription = this.baseSubscribe(data => {
      if (Comparator.isEqual(data, expectedData)) {
        CallbackHelper.triggerCallback(data, callback);
        subscription.destroy();
      }
    });
    return subscription;
  }

  toStream(): Stream2<T> {
    let subscription: IAttachable;
    let stream = new Stream2<T>(
      resolve => {
        subscription = this.subscribe(resolve).attachToRoot();
      },
      () => {
        subscription.destroy();
        console.log('subscription destroyed');
      }
    );
    return stream;
  }

  tap<K>(callback: StreamTouchFunction<T, K>): Stream2<K> {
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
