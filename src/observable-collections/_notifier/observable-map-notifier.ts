import { Sequence } from '../../stream/sequence/sequence';

export class ObservableMapNotifier<KeyType extends number | string, ValueType> {
  protected map: Map<KeyType, ValueType>;

  protected _untilAddedListenersVar?: Map<KeyType, Set<(data: KeyType) => void>>;
  private get _UntilAddedListeners(): Map<KeyType, Set<(data: KeyType) => void>> {
    if (!this._untilAddedListenersVar) {
      this._untilAddedListenersVar = new Map();
    }
    return this._untilAddedListenersVar;
  }

  protected _untilRemovedListenersVar?: Map<KeyType, Set<() => void>>;
  private get _untilRemovedListeners(): Map<KeyType, Set<() => void>> {
    if (!this._untilRemovedListenersVar) {
      this._untilRemovedListenersVar = new Map();
    }
    return this._untilRemovedListenersVar;
  }

  get notifier(): ObservableMapNotifier<KeyType, ValueType> {
    return new ObservableMapNotifier<KeyType, ValueType>(this.map, this._untilAddedListenersVar, this._untilRemovedListenersVar);
  }

  constructor(
    map: Map<KeyType, ValueType>,
    untilAddedListeners?: Map<KeyType, Set<(data: KeyType) => void>>,
    untilRemovedListeners?: Map<KeyType, Set<() => void>>
  ) {
    this.map = map ?? new Map<KeyType, ValueType>();
    this._untilAddedListenersVar = untilAddedListeners;
    this._untilRemovedListenersVar = untilRemovedListeners;
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
        let untilAddedListenerSet = this._UntilAddedListeners.get(value);
        if (!untilAddedListenerSet) {
          untilAddedListenerSet = new Set();
          this._UntilAddedListeners.set(value, untilAddedListenerSet);
        }

        untilAddedListenerSet.add(resolveAndDestroy);
        return () => {
          this._untilAddedListenersVar?.get(value)?.delete(resolveAndDestroy);
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
        let untilRemovedListenerSet = this._untilRemovedListeners.get(value);
        if (!untilRemovedListenerSet) {
          untilRemovedListenerSet = new Set();
          this._untilRemovedListeners.set(value, untilRemovedListenerSet);
        }

        untilRemovedListenerSet.add(resolveAndDestroy);
        return () => {
          this._untilRemovedListenersVar?.get(value)?.delete(resolveAndDestroy);
        };
      }
    });
  }
}
