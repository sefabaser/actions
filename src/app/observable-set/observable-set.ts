import { ObservableMap } from '../observable-map/observable-map';

export class ObservableSet<KeyType extends number | string> {
  private observableMap = new ObservableMap<KeyType, void>();

  get size(): number {
    return this.observableMap.size;
  }

  has(value: KeyType): boolean {
    return this.observableMap.has(value);
  }

  add(key: KeyType): this {
    this.observableMap.add(key, undefined);
    return this;
  }

  remove(key: KeyType): this {
    this.observableMap.remove(key);
    return this;
  }

  async waitUntilAdded(value: KeyType): Promise<void> {
    return this.observableMap.waitUntilAdded(value);
  }

  async waitUntilRemoved(value: KeyType): Promise<void> {
    return this.observableMap.waitUntilRemoved(value);
  }
}
