/** @internal */
export class SequenceHead<T = void> {
  private _pendingValues?: T[];
  _used?: boolean;

  constructor() {
    queueMicrotask(() => {
      if (!this._used) {
        this._destroy();
      }
    });
  }

  _trigger(data: T): void {
    if (!this._pendingValues) {
      this._pendingValues = [];
    }
    this._pendingValues.push(data);
  }

  _destroy(): void {}
}
