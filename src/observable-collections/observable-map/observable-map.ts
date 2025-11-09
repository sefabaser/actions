import { CallbackHelper } from '../../helpers/callback.helper';
import { ObservableMapNotifier } from '../_notifier/observable-map-notifier';

export class ObservableMap<KeyType extends number | string, ValueType> extends ObservableMapNotifier<KeyType, ValueType> {
  constructor(map: Map<KeyType, ValueType> = new Map<KeyType, ValueType>()) {
    super(map);
  }

  set(key: KeyType, item: ValueType): this {
    this.map.set(key, item);
    if (this._untilAddedListeners) {
      if (this._untilAddedListeners.has(key)) {
        let listeners = this._untilAddedListeners.get(key);
        if (listeners) {
          for (let listener of listeners) {
            CallbackHelper.triggerCallback(undefined, listener);
          }
        }
        this._untilAddedListeners.delete(key);

        if (this._untilAddedListeners.size === 0) {
          this._untilAddedListeners = undefined;
        }
      }
    }
    return this;
  }

  delete(key: KeyType): this {
    this.map.delete(key);
    if (this._untilRemovedListeners) {
      if (this._untilRemovedListeners.has(key)) {
        let listeners = this._untilRemovedListeners.get(key);
        if (listeners) {
          for (let listener of listeners) {
            CallbackHelper.triggerCallback(undefined, listener);
          }
        }
        this._untilRemovedListeners.delete(key);

        if (this._untilRemovedListeners.size === 0) {
          this._untilRemovedListeners = undefined;
        }
      }
    }
    return this;
  }
}
