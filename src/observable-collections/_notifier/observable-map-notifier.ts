import { SingleEvent } from '../../stream/single-event/single-event';

export class ObservableMapNotifier<KeyType extends number | string, ValueType> {
  protected map: Map<KeyType, ValueType>;

  /** @internal */
  protected _untilAddedListenersVar?: Map<KeyType, Set<(data: ValueType) => void>>;
  private get _UntilAddedListeners(): Map<KeyType, Set<(data: ValueType) => void>> {
    if (!this._untilAddedListenersVar) {
      this._untilAddedListenersVar = new Map();
    }
    return this._untilAddedListenersVar;
  }

  /** @internal */
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
    untilAddedListeners?: Map<KeyType, Set<(data: ValueType) => void>>,
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

  waitUntilAdded(value: KeyType): SingleEvent<ValueType> {
    return SingleEvent.create<ValueType>(resolve => {
      if (this.map.has(value)) {
        resolve(this.map.get(value)!);
      } else {
        let untilAddedListenerSet = this._UntilAddedListeners.get(value);
        if (!untilAddedListenerSet) {
          untilAddedListenerSet = new Set();
          this._UntilAddedListeners.set(value, untilAddedListenerSet);
        }

        untilAddedListenerSet.add(resolve);
        return () => {
          this._untilAddedListenersVar?.get(value)?.delete(resolve);
        };
      }
    });
  }

  waitUntilRemoved(value: KeyType): SingleEvent<void> {
    return SingleEvent.create((resolve, executor) => {
      if (!this.map.has(value)) {
        resolve();
      } else {
        let untilRemovedListenerSet = this._untilRemovedListeners.get(value);
        if (!untilRemovedListenerSet) {
          untilRemovedListenerSet = new Set();
          this._untilRemovedListeners.set(value, untilRemovedListenerSet);
        }

        untilRemovedListenerSet.add(resolve);
        return () => {
          this._untilRemovedListenersVar?.get(value)?.delete(resolve);
        };
      }
    });
  }
}
