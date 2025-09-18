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

  get(key: KeyType): void {
    this.observableMap.get(key);
  }

  remove(key: KeyType): this {
    this.observableMap.remove(key);
    return this;
  }

  waitUntilAddedSync(value: KeyType, callback: (value: KeyType) => void): void {
    this.observableMap.waitUntilAddedSync(value, () => {
      try {
        callback(value);
      } catch (e) {
        console.error('Observable set callback function error: ', e);
      }
    });
  }

  async waitUntilAdded(value: KeyType): Promise<void> {
    return this.observableMap.waitUntilAdded(value);
  }

  waitUntilRemovedSync(value: KeyType, callback: () => void): void {
    this.observableMap.waitUntilRemovedSync(value, callback);
  }

  async waitUntilRemoved(value: KeyType): Promise<void> {
    return this.observableMap.waitUntilRemoved(value);
  }
}
