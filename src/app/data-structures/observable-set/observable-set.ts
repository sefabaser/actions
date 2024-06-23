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

  get(key: KeyType): void {
    this.observableMap.get(key);
  }

  remove(key: KeyType): this {
    this.observableMap.remove(key);
    return this;
  }

  waitUntilAddedSync(value: KeyType, callback: (value: KeyType) => void): void {
    this.observableMap.waitUntilAddedSync(value, () => callback(value));
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
