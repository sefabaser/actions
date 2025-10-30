import { Attachable } from '../../attachable/attachable';
import { IAttachable } from '../../attachable/base-attachable';
import { CallbackHelper } from '../../helpers/callback.helper';
import { NotifierCallbackFunction } from '../../observables/_notifier/notifier';
import { ActionSubscription } from '../../utilities/action-subscription';

export class ObservableMapNotifier<KeyType extends number | string, ValueType> {
  protected map: Map<KeyType, ValueType>;

  protected _untilAddedListeners?: Map<KeyType, Set<(data: KeyType) => void>>;
  private get untilAddedListeners(): Map<KeyType, Set<(data: KeyType) => void>> {
    if (!this._untilAddedListeners) {
      this._untilAddedListeners = new Map();
    }
    return this._untilAddedListeners;
  }

  protected _untilRemovedListeners?: Map<KeyType, Set<() => void>>;
  private get untilRemovedListeners(): Map<KeyType, Set<() => void>> {
    if (!this._untilRemovedListeners) {
      this._untilRemovedListeners = new Map();
    }
    return this._untilRemovedListeners;
  }

  get notifier(): ObservableMapNotifier<KeyType, ValueType> {
    return new ObservableMapNotifier<KeyType, ValueType>(this.map, this._untilAddedListeners, this._untilRemovedListeners);
  }

  constructor(
    map: Map<KeyType, ValueType>,
    untilAddedListeners?: Map<KeyType, Set<(data: KeyType) => void>>,
    untilRemovedListeners?: Map<KeyType, Set<() => void>>
  ) {
    this.map = map ?? new Map<KeyType, ValueType>();
    this._untilAddedListeners = untilAddedListeners;
    this._untilRemovedListeners = untilRemovedListeners;
  }

  convertToMap(): Map<KeyType, ValueType> {
    return new Map(this.map);
  }

  get size(): number {
    return this.map.size;
  }

  has(value: KeyType): boolean {
    return this.map.has(value);
  }

  get(key: KeyType): ValueType | undefined {
    return this.map.get(key);
  }

  waitUntilAdded(value: KeyType, callback: NotifierCallbackFunction<ValueType>): IAttachable {
    let triggerCallback = () => {
      CallbackHelper.triggerCallback(this.map.get(value), callback);
    };

    if (this.map.has(value)) {
      triggerCallback();
      return Attachable.getDestroyed();
    } else {
      let untilAddedListenerSet = this.untilAddedListeners.get(value);
      if (!untilAddedListenerSet) {
        untilAddedListenerSet = new Set();
        this.untilAddedListeners.set(value, untilAddedListenerSet);
      }

      untilAddedListenerSet.add(triggerCallback);
      return new ActionSubscription(() => {
        this._untilAddedListeners?.get(value)?.delete(triggerCallback);
      });
    }
  }

  waitUntilRemoved(value: KeyType, callback: NotifierCallbackFunction<void>): IAttachable {
    if (!this.map.has(value)) {
      CallbackHelper.triggerCallback(undefined, callback);
      return Attachable.getDestroyed();
    } else {
      let untilRemovedListenerSet = this.untilRemovedListeners.get(value);
      if (!untilRemovedListenerSet) {
        untilRemovedListenerSet = new Set();
        this.untilRemovedListeners.set(value, untilRemovedListenerSet);
      }

      let item = () => {
        CallbackHelper.triggerCallback(undefined, callback);
      };
      untilRemovedListenerSet.add(item);
      return new ActionSubscription(() => {
        this._untilRemovedListeners?.get(value)?.delete(item);
      });
    }
  }
}
