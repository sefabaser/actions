import { Sequence } from '../../stream/sequence/sequence';
import { ObservableMap } from '../observable-map/observable-map';

export class ObservableSet<KeyType extends number | string> {
  private observableMap = new ObservableMap<KeyType, void>();

  constructor(set?: Set<KeyType> | undefined) {
    let map = set ? new Map(Array.from(set.keys()).map(key => [key, undefined])) : undefined;
    this.observableMap = new ObservableMap<KeyType, void>(map);
  }

  convertToSet(): Set<KeyType> {
    return new Set(this.observableMap.convertToMap().keys());
  }

  get size(): number {
    return this.observableMap.size;
  }

  has(value: KeyType): boolean {
    return this.observableMap.has(value);
  }

  add(key: KeyType): this {
    this.observableMap.set(key, undefined);
    return this;
  }

  delete(key: KeyType): this {
    this.observableMap.delete(key);
    return this;
  }

  waitUntilAdded(value: KeyType): Sequence<void> {
    return this.observableMap.waitUntilAdded(value);
  }

  waitUntilRemoved(value: KeyType): Sequence<void> {
    return this.observableMap.waitUntilRemoved(value);
  }
}
