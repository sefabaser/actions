import { Attachable, type IAttachment } from '../../attachable/attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';

export class ActionSubscription extends Attachable {
  constructor(private _destroyCallback: () => void) {
    super();
  }

  override destroy(): void {
    if (!this._destroyed) {
      this._destroyCallback();
      super.destroy();
    }
  }
}

export type NotifierCallbackFunction<T> = (data: T) => void;

export class NotifierBase<T = void> {
  protected _listenersMapVar: Map<number, NotifierCallbackFunction<T>> | undefined;
  protected get _listenersMap() {
    if (!this._listenersMapVar) {
      this._listenersMapVar = new Map<number, NotifierCallbackFunction<T>>();
    }
    return this._listenersMapVar;
  }

  protected _nextAvailableSubscriptionID = { v: 1 };

  get listenerCount(): number {
    return this._listenersMapVar?.size ?? 0;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID.v++;
    this._listenersMap.set(subscriptionID, callback);

    return new ActionSubscription(() => this._listenersMap.delete(subscriptionID));
  }

  toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID.v++;
      this._listenersMap.set(subscriptionID, resolve);
      return () => this._listenersMap.delete(subscriptionID);
    });
  }

  toSingleEvent(): SingleEvent<T> {
    return SingleEvent.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID.v++;
      this._listenersMap.set(subscriptionID, resolve);
      return () => this._listenersMap.delete(subscriptionID);
    });
  }

  clear(): void {
    this._listenersMapVar?.clear();
  }

  /** @internal */
  _triggerAll(data: T): void {
    if (this._listenersMapVar) {
      /*
      let listeners = [...this._listenersMapVar.values()];
      for (let i = 0; i < listeners.length; i++) {
        CallbackHelper._triggerCallback(data, listeners[i]);
      }*/
      // 2.4265999794006348
      // after repetation 10k: 60.559799909591675

      let listenerKeys = [...this._listenersMapVar.keys()];
      for (let i = 0; i < listenerKeys.length; i++) {
        let listener = this._listenersMapVar.get(listenerKeys[i]);
        if (listener !== undefined) {
          CallbackHelper._triggerCallback(data, listener);
        }
      }
      // 7.984999895095825
      // only key: 3.8285999298095703
      // not checking has(key): 3.557300090789795
      // after repetation 10k: 68.83400011062622

      /*
      for (let listener of this._listenersMapVar.values()) {
        CallbackHelper._triggerCallback(data, listener);
      }*/
      // 2.3047001361846924
      // after repetation 10k: 52.22070002555847
    }
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): Attachable {
    let subscriptionID = this._nextAvailableSubscriptionID.v++;

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
