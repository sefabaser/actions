import { CallbackHelper } from '../../helpers/callback.helper';
import { ObservableMapNotifier } from '../_notifier/observable-map-notifier';

export class ObservableMap<KeyType extends number | string, ValueType> extends ObservableMapNotifier<KeyType, ValueType> {
  constructor(map: Map<KeyType, ValueType> = new Map<KeyType, ValueType>()) {
    super(map);
  }

  set(key: KeyType, item: ValueType): this {
    this.map.set(key, item);
    if (this._untilAddedListenersVar) {
      if (this._untilAddedListenersVar.has(key)) {
        let listeners = this._untilAddedListenersVar.get(key);
        if (listeners) {
          let arr = [...listeners];
          for (let i = 0; i < arr.length; i++) {
            CallbackHelper._triggerCallback<ValueType>(item, arr[i]);
          }
        }
        this._untilAddedListenersVar.delete(key);

        if (this._untilAddedListenersVar.size === 0) {
          this._untilAddedListenersVar = undefined;
        }
      }
    }
    return this;
  }

  delete(key: KeyType): this {
    this.map.delete(key);
    if (this._untilRemovedListenersVar) {
      if (this._untilRemovedListenersVar.has(key)) {
        let listeners = this._untilRemovedListenersVar.get(key);
        if (listeners) {
          let arr = [...listeners];
          for (let i = 0; i < arr.length; i++) {
            CallbackHelper._triggerCallback(undefined, arr[i]);
          }
        }
        this._untilRemovedListenersVar.delete(key);

        if (this._untilRemovedListenersVar.size === 0) {
          this._untilRemovedListenersVar = undefined;
        }
      }
    }
    return this;
  }
}
