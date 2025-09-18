export class ObservableMap<KeyType extends number | string, ValueType> {
  private map: Map<KeyType, ValueType>;

  private untilAddedListeners = new Map<KeyType, Set<(data: KeyType) => void>>();
  private untilRemovedListeners = new Map<KeyType, Set<(data: KeyType) => void>>();

  constructor(map?: Map<KeyType, ValueType> | undefined) {
    this.map = map ?? new Map<KeyType, ValueType>();
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

  set(key: KeyType, item: ValueType): this {
    this.map.set(key, item);
    if (this.untilAddedListeners.has(key)) {
      this.untilAddedListeners.get(key)?.forEach(callback => {
        try {
          callback(key);
        } catch (e) {
          console.error('Observable map callback function error: ', e);
        }
      });
      this.untilAddedListeners.delete(key);
    }
    return this;
  }

  get(key: KeyType): ValueType | undefined {
    return this.map.get(key);
  }

  remove(key: KeyType): this {
    this.map.delete(key);
    if (this.untilRemovedListeners.has(key)) {
      this.untilRemovedListeners.get(key)?.forEach(callback => {
        try {
          callback(key);
        } catch (e) {
          console.error('Observable map callback function error: ', e);
        }
      });
      this.untilRemovedListeners.delete(key);
    }
    return this;
  }

  waitUntilAddedSync(value: KeyType, callback: (item: ValueType) => void): void {
    if (this.map.has(value)) {
      try {
        callback(this.map.get(value) as ValueType);
      } catch (e) {
        console.error('Observable map callback function error: ', e);
      }
    } else {
      if (!this.untilAddedListeners.has(value)) {
        this.untilAddedListeners.set(value, new Set());
      }
      this.untilAddedListeners.get(value)?.add(() => {
        try {
          callback(this.map.get(value) as ValueType);
        } catch (e) {
          console.error('Observable map callback function error: ', e);
        }
      });
    }
  }

  async waitUntilAdded(value: KeyType): Promise<ValueType> {
    return new Promise<ValueType>(resolve => {
      this.waitUntilAddedSync(value, item => resolve(item));
    });
  }

  waitUntilRemovedSync(value: KeyType, callback: () => void): void {
    if (!this.map.has(value)) {
      try {
        callback();
      } catch (e) {
        console.error('Observable map callback function error: ', e);
      }
    } else {
      if (!this.untilRemovedListeners.has(value)) {
        this.untilRemovedListeners.set(value, new Set());
      }
      this.untilRemovedListeners.get(value)?.add(() => {
        try {
          callback();
        } catch (e) {
          console.error('Observable map callback function error: ', e);
        }
      });
    }
  }

  async waitUntilRemoved(value: KeyType): Promise<void> {
    return new Promise<void>(resolve => {
      this.waitUntilRemovedSync(value, () => resolve());
    });
  }
}
