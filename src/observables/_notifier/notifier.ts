import { IAttachable } from '../..';
import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation, SyncOperation } from '../../common';
import { CallbackHelper } from '../../helpers/callback.helper';
import { ISequenceLinkContext, Sequence } from '../../sequence/sequence';

export class ActionSubscription extends Attachable {
  constructor(private destroyCallback: () => void) {
    super();
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyCallback();
      super.destroy();
    }
  }
}

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
  static fromSequence<S>(sequence: Sequence<S>): {
    attach: (parent: IAttachable) => Notifier<S>;
    attachById: (parent: number) => Notifier<S>;
    attachToRoot: () => Notifier<S>;
  } {
    if (sequence.attachIsCalled) {
      throw new Error('Attached sequences cannot be converted to notifier!');
    }

    let notifier = new Notifier<S>();
    sequence.readSingle(data => notifier.triggerAll(data));
    return {
      attach: (parent: IAttachable) => {
        sequence.attach(parent);
        return notifier;
      },
      attachById: (id: number) => {
        sequence.attachById(id);
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
    wrapper.subscribe = this.subscribe.bind(this);
    return wrapper;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    let subscriptionId = this.nextAvailableSubscriptionId++;
    this.listenersMap.set(subscriptionId, callback);

    return new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });
  }

  toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscription = this.subscribe(resolve).attachToRoot();
      return subscription.destroy.bind(subscription);
    });
  }

  map<K>(callback: (data: T, context: ISequenceLinkContext) => SyncOperation<K>): Sequence<K> {
    return this.toSequence().map(callback);
  }

  orderedMap<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    return this.toSequence().asyncMapOrdered(callback);
  }

  filter(callback: (data: T, previousValue: T | undefined) => boolean): Sequence<T> {
    return this.toSequence().filter(callback);
  }

  take(count: number): Sequence<T> {
    return this.toSequence().take(count);
  }

  skip(count: number): Sequence<T> {
    return this.toSequence().skip(count);
  }

  /** @internal */
  triggerAll(data: T): void {
    let listeners = [...this.listenersMap.values()];
    for (let i = 0; i < listeners.length; i++) {
      CallbackHelper.triggerCallback(data, listeners[i]);
    }
  }

  /** @internal */
  readSingle(callback: (data: T) => void): IAttachment {
    let subscriptionId = this.nextAvailableSubscriptionId++;

    let subscription = new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });

    this.listenersMap.set(subscriptionId, data => {
      subscription.destroy();
      callback(data);
    });

    return subscription;
  }
}
