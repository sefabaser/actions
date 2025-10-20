import { NotificationHelper } from '../../helpers/notification.helper';
import { ObservableMapNotifier } from '../_notifier/observable-map-notifier';

export class ObservableMap<KeyType extends number | string, ValueType> extends ObservableMapNotifier<KeyType, ValueType> {
  constructor(map: Map<KeyType, ValueType> = new Map<KeyType, ValueType>()) {
    super(map);
  }

  set(key: KeyType, item: ValueType): this {
    this.map.set(key, item);
    if (this._untilAddedListeners) {
      if (this._untilAddedListeners.has(key)) {
        this._untilAddedListeners.get(key)?.forEach(callback => NotificationHelper.notify(undefined, callback));
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
        this._untilRemovedListeners.get(key)?.forEach(callback => {
          NotificationHelper.notify(undefined, callback);
        });
        this._untilRemovedListeners.delete(key);

        if (this._untilRemovedListeners.size === 0) {
          this._untilRemovedListeners = undefined;
        }
      }
    }
    return this;
  }
}
