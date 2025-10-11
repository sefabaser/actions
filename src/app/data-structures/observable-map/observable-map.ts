import { ActionSubscription } from '../../../helpers/notification-handler';

export class ObservableMap<KeyType extends number | string, ValueType> {
  private map: Map<KeyType, ValueType>;

  private _untilAddedListeners?: Map<KeyType, Set<(data: KeyType) => void>>;
  private get untilAddedListeners(): Map<KeyType, Set<(data: KeyType) => void>> {
    if (!this._untilAddedListeners) {
      this._untilAddedListeners = new Map();
    }
    return this._untilAddedListeners;
  }

  private _untilRemovedListeners?: Map<KeyType, Set<(data: KeyType) => void>>;
  private get untilRemovedListeners(): Map<KeyType, Set<(data: KeyType) => void>> {
    if (!this._untilRemovedListeners) {
      this._untilRemovedListeners = new Map();
    }
    return this._untilRemovedListeners;
  }

  constructor(map?: Map<KeyType, ValueType> | undefined) {
    this.map = map ?? new Map<KeyType, ValueType>();
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

  set(key: KeyType, item: ValueType): this {
    this.map.set(key, item);
    if (this._untilAddedListeners) {
      if (this._untilAddedListeners.has(key)) {
        this._untilAddedListeners.get(key)?.forEach(callback => {
          try {
            callback(key);
          } catch (e) {
            console.error('Observable map callback function error: ', e);
          }
        });
        this._untilAddedListeners.delete(key);

        if (this._untilAddedListeners.size === 0) {
          this._untilAddedListeners = undefined;
        }
      }
    }
    return this;
  }

  get(key: KeyType): ValueType | undefined {
    return this.map.get(key);
  }

  delete(key: KeyType): this {
    this.map.delete(key);
    if (this._untilRemovedListeners) {
      if (this._untilRemovedListeners.has(key)) {
        this._untilRemovedListeners.get(key)?.forEach(callback => {
          try {
            callback(key);
          } catch (e) {
            console.error('Observable map callback function error: ', e);
          }
        });
        this._untilRemovedListeners.delete(key);

        if (this._untilRemovedListeners.size === 0) {
          this._untilRemovedListeners = undefined;
        }
      }
    }
    return this;
  }

  waitUntilAdded(value: KeyType, callback: (item: ValueType) => void): ActionSubscription {
    let triggerCallback = () => {
      try {
        callback(this.map.get(value) as ValueType);
      } catch (e) {
        console.error('Observable map callback function error: ', e);
      }
    };

    if (this.map.has(value)) {
      triggerCallback();
      return ActionSubscription.destroyed;
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

  waitUntilRemoved(value: KeyType, callback: () => void): ActionSubscription {
    if (!this.map.has(value)) {
      try {
        callback();
      } catch (e) {
        console.error('Observable map callback function error: ', e);
      }
      return ActionSubscription.destroyed;
    } else {
      let untilRemovedListenerSet = this.untilRemovedListeners.get(value);
      if (!untilRemovedListenerSet) {
        untilRemovedListenerSet = new Set();
        this.untilRemovedListeners.set(value, untilRemovedListenerSet);
      }

      let item = () => {
        try {
          callback();
        } catch (e) {
          console.error('Observable map callback function error: ', e);
        }
      };
      untilRemovedListenerSet.add(item);
      return new ActionSubscription(() => {
        this._untilRemovedListeners?.get(value)?.delete(item);
      });
    }
  }
}
