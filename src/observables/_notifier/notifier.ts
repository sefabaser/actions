import { Comparator } from 'helpers-lib';

import { BaseAttachable, IAttachable } from '../../attachable/base-attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { IStream, Sequence } from '../../sequence/sequence';
import { ActionSubscription } from '../../utilities/action-subscription';

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
  static fromSequence<T>(sequence: Sequence<T>): {
    attach: (parent: BaseAttachable | string) => Notifier<T>;
    attachToRoot: () => Notifier<T>;
  } {
    if (sequence.attachIsCalled) {
      throw new Error('Attached sequences cannot be converted to notifier!');
    }

    let notifier = new Notifier<T>();
    sequence.subscribe(data => notifier.forEach(callback => CallbackHelper.triggerCallback(data, callback)));
    return {
      attach: (parent: BaseAttachable | string) => {
        sequence.attach(parent);
        return notifier;
      },
      attachToRoot: () => {
        sequence.attachToRoot();
        return notifier;
      }
    };
  }

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

  /** @internal */
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

  toSequence(): Sequence<T> {
    let subscription: IAttachable;
    return Sequence.create<T>(resolve => {
      subscription = this.subscribe(resolve).attachToRoot();
      return () => subscription.destroy();
    });
  }

  map<K>(callback: (data: T) => K | IStream<K>): Sequence<K> {
    return this.toSequence().map(callback);
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
