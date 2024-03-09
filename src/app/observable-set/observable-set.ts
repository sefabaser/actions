export class ObservableSet<T extends number | string> {
  private set = new Set<T>();

  private untilAddedListeners = new Map<T, Set<(data: T) => void>>();
  private untilRemovedListeners = new Map<T, Set<(data: T) => void>>();

  get size(): number {
    return this.set.size;
  }

  has(value: T): boolean {
    return this.set.has(value);
  }

  add(data: T): this {
    this.set.add(data);
    if (this.untilAddedListeners.has(data)) {
      this.untilAddedListeners.get(data)?.forEach(callback => callback(data));
      this.untilAddedListeners.delete(data);
    }
    return this;
  }

  remove(data: T): this {
    this.set.delete(data);
    if (this.untilRemovedListeners.has(data)) {
      this.untilRemovedListeners.get(data)?.forEach(callback => callback(data));
      this.untilRemovedListeners.delete(data);
    }
    return this;
  }

  async waitUntilAdded(value: T): Promise<void> {
    if (this.set.has(value)) {
      return;
    }

    return new Promise<void>(resolve => {
      if (!this.untilAddedListeners.has(value)) {
        this.untilAddedListeners.set(value, new Set());
      }
      this.untilAddedListeners.get(value)?.add(() => resolve());
    });
  }

  async waitUntilRemoved(value: T): Promise<void> {
    if (!this.set.has(value)) {
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
