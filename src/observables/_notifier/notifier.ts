import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { ISequenceLinkContext } from '../../stream/sequence/sequence-executor';
import { SingleEvent } from '../../stream/single-event/single-event';

export class ActionSubscription extends Attachable {
  constructor(private _destroyCallback: () => void) {
    super();
  }

  destroy(): void {
    if (!this._destroyed) {
      this._destroyCallback();
      super.destroy();
    }
  }
}

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
  static fromSequence<S>(sequence: Sequence<S>): {
    attach: (parent: Attachable) => Notifier<S>;
    attachByID: (parent: number) => Notifier<S>;
    attachToRoot: () => Notifier<S>;
  } {
    if (sequence.attachIsCalled) {
      throw new Error('Attached sequences cannot be converted to notifier!');
    }

    let notifier = new Notifier<S>();
    sequence._subscribeSingle(data => notifier._triggerAll(data));
    return {
      attach: (parent: Attachable) => {
        sequence.attach(parent);
        return notifier;
      },
      attachByID: (id: number) => {
        sequence.attachByID(id);
        return notifier;
      },
      attachToRoot: () => {
        sequence.attachToRoot();
        return notifier;
      }
    };
  }

  private _listenersMap = new Map<number, NotifierCallbackFunction<T>>();
  private _nextAvailableSubscriptionID = 1;

  get listenerCount(): number {
    return this._listenersMap.size;
  }

  get notifier(): Notifier<T> {
    let wrapper = new Notifier<T>();
    wrapper._listenersMap = this._listenersMap;
    wrapper._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
    wrapper.subscribe = this.subscribe.bind(this);
    return wrapper;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID++;
    this._listenersMap.set(subscriptionID, callback);

    return new ActionSubscription(() => {
      this._listenersMap.delete(subscriptionID);
    });
  }

  toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID++;
      this._listenersMap.set(subscriptionID, resolve);
      return () => this._listenersMap.delete(subscriptionID);
    });
  }

  toSingleEvent(): SingleEvent<T> {
    return SingleEvent.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID++;
      this._listenersMap.set(subscriptionID, event => {
        resolve(event);
        this._listenersMap.delete(subscriptionID);
      });
      return () => this._listenersMap.delete(subscriptionID);
    });
  }

  map<K>(callback: (data: T, context: ISequenceLinkContext) => K): Sequence<K> {
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
  _triggerAll(data: T): void {
    let listeners = [...this._listenersMap.values()];
    for (let i = 0; i < listeners.length; i++) {
      CallbackHelper._triggerCallback(data, listeners[i]);
    }
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID++;

    let subscription = new ActionSubscription(() => {
      this._listenersMap.delete(subscriptionID);
    });

    this._listenersMap.set(subscriptionID, data => {
      subscription.destroy();
      callback(data);
    });

    return subscription;
  }
}
