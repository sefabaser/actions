import { Attachable, IAttachable } from '../attachable/attachable';

export class Stream<T> implements IAttachable {
  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    executor(data => this.dataReceived(data));
  }

  tap<K>(callback: (data: T) => K | Stream<K>): Stream<K> {
    let nextInLine = new Stream<K>(
      () => {},
      () => this.destroy()
    );
    this.registerNextInLine(callback, nextInLine);
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

  private resolvedBeforeListenerBy: T | undefined;
  private listener: ((data: T) => void) | undefined;
  private dataReceived(data: T): void {
    if (!this._destroyed) {
      if (this.listener) {
        this.listener(data);
      } else {
        this.resolvedBeforeListenerBy = data;
      }
    }
  }

  private registerNextInLine<K>(executionCallback: (data: T) => K | Stream<K>, nextInLine: Stream<K>): void {
    this.subscribe(data => {
      this.waitUntilExecution(data, executionCallback, executionReturn => {
        nextInLine.dataReceived(executionReturn);
      });
    });
  }

  private waitUntilExecution<K>(data: T, executionCallback: (data: T) => K | Stream<K>, callback: (data: K) => void): void {
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

  private subscribe<K>(callback: (data: T) => K | Stream<K>): void {
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
