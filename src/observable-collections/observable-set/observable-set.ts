import { Sequence } from '../../stream/sequence/sequence';
import { ObservableMap } from '../observable-map/observable-map';

export class ObservableSet<KeyType extends number | string> {
  private _observableMap = new ObservableMap<KeyType, void>();

  constructor(set?: Set<KeyType> | undefined) {
    let map = set ? new Map(Array.from(set.keys()).map(key => [key, undefined])) : undefined;
    this._observableMap = new ObservableMap<KeyType, void>(map);
  }

  convertToSet(): Set<KeyType> {
    return new Set(this._observableMap.convertToMap().keys());
  }

  get size(): number {
    return this._observableMap.size;
  }

  has(value: KeyType): boolean {
    return this._observableMap.has(value);
  }

  add(key: KeyType): this {
    this._observableMap.set(key, undefined);
    return this;
  }

  delete(key: KeyType): this {
    this._observableMap.delete(key);
    return this;
  }

  waitUntilAdded(value: KeyType): Sequence<void> {
    return this._observableMap.waitUntilAdded(value);
  }

  waitUntilRemoved(value: KeyType): Sequence<void> {
    return this._observableMap.waitUntilRemoved(value);
  }
}
