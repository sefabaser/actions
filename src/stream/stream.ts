import { Attachable, IAttachable } from '../attachable/attachable';

export type StreamTouchFunction<T, K> = (data: T) => K | Stream<K>;

export class Stream<T> implements IAttachable {
  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    executor(data => this.trigger(data));
  }

  tap<K>(callback: StreamTouchFunction<T, K>): Stream<K> {
    let nextInLine = new Stream<K>(
      () => {},
      () => this.destroy()
    );

    this.subscribe(data => {
      this.waitUntilExecution(data, callback, executionReturn => {
        nextInLine.trigger(executionReturn);
      });
    });

    return nextInLine;
  }

  destroy(): void {
    this.listener = undefined;
    this.resolvedBeforeListenerBy = undefined;
    this._destroyed = true;
    this.onDestroy?.();
  }

  attach(parent: Attachable | string): this {
    return this;
  }

  attachToRoot(): this {
    return this;
  }

  private waitUntilExecution<K>(data: T, executionCallback: StreamTouchFunction<T, K>, callback: (data: K) => void): void {
    let executionReturn = executionCallback(data);
    if (executionReturn instanceof Stream) {
      let executionStream: Stream<K> = executionReturn;
      executionStream.subscribe(innerData => {
        executionStream.destroy();
        callback(innerData);
      });
    } else {
      callback(executionReturn);
    }
  }

  private resolvedBeforeListenerBy: T | undefined;
  private listener: ((data: T) => void) | undefined;
  private trigger(data: T): void {
    if (!this._destroyed) {
      if (this.listener) {
        this.listener(data);
      } else {
        this.resolvedBeforeListenerBy = data;
      }
    }
  }

  private subscribe<K>(callback: StreamTouchFunction<T, K>): void {
    if (this._destroyed) {
      throw new Error('Stream is destroyed');
    }
    if (this.listener) {
      throw new Error('Stream is already being listened to');
    }

    if (this.resolvedBeforeListenerBy) {
      callback(this.resolvedBeforeListenerBy);
      this.resolvedBeforeListenerBy = undefined;
    }
    this.listener = data => callback(data);
  }
}
