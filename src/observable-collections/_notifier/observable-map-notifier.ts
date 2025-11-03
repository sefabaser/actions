import { Sequence } from '../../sequence/sequence';

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

  waitUntilAdded(value: KeyType): Sequence<ValueType> {
    return Sequence.create<ValueType>((resolve, executor) => {
      let resolveAndDestroy = () => {
        resolve(this.map.get(value)!);
        executor.final();
      };

      if (this.map.has(value)) {
        resolveAndDestroy();
      } else {
        let untilAddedListenerSet = this.untilAddedListeners.get(value);
        if (!untilAddedListenerSet) {
          untilAddedListenerSet = new Set();
          this.untilAddedListeners.set(value, untilAddedListenerSet);
        }

        untilAddedListenerSet.add(resolveAndDestroy);
        return () => {
          this._untilAddedListeners?.get(value)?.delete(resolveAndDestroy);
        };
      }
    });
  }

  waitUntilRemoved(value: KeyType): Sequence<void> {
    return Sequence.create((resolve, executor) => {
      let resolveAndDestroy = () => {
        resolve();
        executor.final();
      };

      if (!this.map.has(value)) {
        resolveAndDestroy();
      } else {
        let untilRemovedListenerSet = this.untilRemovedListeners.get(value);
        if (!untilRemovedListenerSet) {
          untilRemovedListenerSet = new Set();
          this.untilRemovedListeners.set(value, untilRemovedListenerSet);
        }

        untilRemovedListenerSet.add(resolveAndDestroy);
        return () => {
          this._untilRemovedListeners?.get(value)?.delete(resolveAndDestroy);
        };
      }
    });
  }
}
