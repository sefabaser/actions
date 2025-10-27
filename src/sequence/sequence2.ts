import { IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T> = Notifier<T> | Sequence2<T>;
export type SequenceTouchFunction<T, K> = (data: T) => K | IStream<K>;

export class Sequence2<T> extends LightweightAttachable {
  private _nextInLine: Sequence2<unknown> | undefined;
  private _resolvedBeforeListenerBy: T[] | undefined;
  private _listener: ((data: T) => void) | undefined;
  private _onDestroyListeners = new Set<() => void>();

  constructor(executor: (resolve: (data: T) => void) => void, onDestroy?: () => void) {
    super();
    executor(data => this.trigger(data));
    if (onDestroy) {
      this._onDestroyListeners.add(() => onDestroy());
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      this._listener = undefined;
      this._resolvedBeforeListenerBy = undefined;
      this._nextInLine = undefined;

      super.destroy();

      for (let item of this._onDestroyListeners) {
        item();
      }
      this._onDestroyListeners = undefined as any;
    }
  }

  read(callback: (data: T) => void): Sequence2<T> {
    if (!this._listener) {
      this.subscribe(data => callback(data), false);
      return this;
    } else {
      let nextInLine = this.createNextInLine<T>();
      this._listener = undefined;

      this.subscribe(data => {
        callback(data);
        nextInLine.trigger(data);
      });
      return nextInLine;
    }
  }

  private createNextInLine<K>(): Sequence2<K> {
    if (this._nextInLine) {
      throw new Error('A sequence can only be linked once.');
    }
    if (this._attachIsCalled) {
      throw new Error('After attaching a sequence you cannot add another operation.');
    }

    let nextInLine = new Sequence2<K>(
      () => {},
      () => this.destroy()
    );
    this.attachToRoot(); // Destroying is manually done by listening nextInLine
    this._nextInLine = nextInLine;
    return nextInLine;
  }

  private trigger(data: T): void {
    if (!this.destroyed) {
      if (this._listener) {
        this._listener(data);
      } else {
        if (!this._resolvedBeforeListenerBy) {
          this._resolvedBeforeListenerBy = [];
        }
        this._resolvedBeforeListenerBy.push(data);
      }
    }
  }

  /** @internal */
  subscribe(callback: NotifierCallbackFunction<T>, eraseHistory = true): IAttachable {
    if (this.destroyed) {
      throw new Error('Sequence is destroyed');
    }
    if (this._listener) {
      throw new Error('Sequence is already being listened to');
    }

    if (this._resolvedBeforeListenerBy) {
      for (let data of this._resolvedBeforeListenerBy) {
        callback(data);
      }
      if (eraseHistory) {
        this._resolvedBeforeListenerBy = undefined;
      }
    }
    this._listener = data => callback(data);
    return this;
  }
}
