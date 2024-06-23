export class ObservableMap<KeyType extends number | string, ItemType> {
  private map = new Map<KeyType, ItemType>();

  private untilAddedListeners = new Map<KeyType, Set<(data: KeyType) => void>>();
  private untilRemovedListeners = new Map<KeyType, Set<(data: KeyType) => void>>();

  get size(): number {
    return this.map.size;
  }

  has(value: KeyType): boolean {
    return this.map.has(value);
  }

  add(key: KeyType, item: ItemType): this {
    this.map.set(key, item);
    if (this.untilAddedListeners.has(key)) {
      this.untilAddedListeners.get(key)?.forEach(callback => callback(key));
      this.untilAddedListeners.delete(key);
    }
    return this;
  }

  get(key: KeyType): ItemType | undefined {
    return this.map.get(key);
  }

  remove(key: KeyType): this {
    this.map.delete(key);
    if (this.untilRemovedListeners.has(key)) {
      this.untilRemovedListeners.get(key)?.forEach(callback => callback(key));
      this.untilRemovedListeners.delete(key);
    }
    return this;
  }

  waitUntilAddedSync(value: KeyType, callback: (item: ItemType) => void): void {
    if (this.map.has(value)) {
      callback(this.map.get(value) as ItemType);
    } else {
      if (!this.untilAddedListeners.has(value)) {
        this.untilAddedListeners.set(value, new Set());
      }
      this.untilAddedListeners.get(value)?.add(() => callback(this.map.get(value) as ItemType));
    }
  }

  async waitUntilAdded(value: KeyType): Promise<ItemType> {
    return new Promise<ItemType>(resolve => {
      this.waitUntilAddedSync(value, item => resolve(item));
    });
  }

  waitUntilRemovedSync(value: KeyType, callback: () => void): void {
    if (!this.map.has(value)) {
      callback();
    } else {
      if (!this.untilRemovedListeners.has(value)) {
        this.untilRemovedListeners.set(value, new Set());
      }
      this.untilRemovedListeners.get(value)?.add(() => callback());
    }
  }

  async waitUntilRemoved(value: KeyType): Promise<void> {
    return new Promise<void>(resolve => {
      this.waitUntilRemovedSync(value, () => resolve());
    });
  }
}
