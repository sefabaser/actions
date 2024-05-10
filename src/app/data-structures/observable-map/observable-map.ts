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

  remove(key: KeyType): this {
    this.map.delete(key);
    if (this.untilRemovedListeners.has(key)) {
      this.untilRemovedListeners.get(key)?.forEach(callback => callback(key));
      this.untilRemovedListeners.delete(key);
    }
    return this;
  }

  async waitUntilAdded(value: KeyType): Promise<ItemType> {
    if (this.map.has(value)) {
      return this.map.get(value) as ItemType;
    }

    return new Promise<ItemType>(resolve => {
      if (!this.untilAddedListeners.has(value)) {
        this.untilAddedListeners.set(value, new Set());
      }
      this.untilAddedListeners.get(value)?.add(() => resolve(this.map.get(value) as ItemType));
    });
  }

  async waitUntilRemoved(value: KeyType): Promise<void> {
    if (!this.map.has(value)) {
      return;
    }

    return new Promise<void>(resolve => {
      if (!this.untilRemovedListeners.has(value)) {
        this.untilRemovedListeners.set(value, new Set());
      }
      this.untilRemovedListeners.get(value)?.add(() => resolve());
    });
  }
}
