import { IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { CallbackHelper } from '../helpers/callback.helper';
import { Notifier } from '../observables/_notifier/notifier';

export type StreamTouchFunction<T, K> = (data: T) => K | Stream<K> | Notifier<K>;

export class Stream<T> extends LightweightAttachable {
  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    super();
    executor(data => this.trigger(data));
  }

  tap<K>(callback: StreamTouchFunction<T, K>): Stream<K> {
    let nextInLine = new Stream<K>(
      () => {},
      () => this.destroy()
    );
    this.attachToRoot(); // Destroying is manually done by listening nextInLine

    this.subscribe(data => {
      this.waitUntilExecution(data, callback, executionReturn => {
        nextInLine.trigger(executionReturn);
      });
    });

    return nextInLine;
  }

  private _toBeDestroyed: Set<IAttachable> | undefined;
  private get toBeDestroyed(): Set<IAttachable> {
    if (!this._toBeDestroyed) {
      this._toBeDestroyed = new Set<IAttachable>();
    }
    return this._toBeDestroyed;
  }

  destroy(): void {
    if (!this.destroyed) {
      this.listener = undefined;
      this.resolvedBeforeListenerBy = undefined;
      this.toBeDestroyed.forEach(item => item.destroy());
      this.toBeDestroyed.clear();
      this._toBeDestroyed = undefined;
      this.onDestroy?.();
      super.destroy();
    }
  }

  private waitUntilExecution<K>(data: T, executionCallback: StreamTouchFunction<T, K>, callback: (data: K) => void): void {
    let executionReturn = executionCallback(data);
    if (executionReturn instanceof Stream) {
      let executionStream: Stream<K> = executionReturn;
      executionStream.subscribe(innerData => {
        this.toBeDestroyed.delete(executionStream);
        executionStream.destroy();
        CallbackHelper.triggerCallback(innerData, callback);
      });
      this.toBeDestroyed.add(executionStream);
      executionStream.attachToRoot();
    } else if (executionReturn instanceof Notifier) {
      let executionNotifier: Notifier<K> = executionReturn;
      let subscription = executionNotifier
        .waitUntilNext(innerData => {
          this.toBeDestroyed.delete(subscription);
          CallbackHelper.triggerCallback(innerData, callback);
        })
        .attachToRoot();
      this.toBeDestroyed.add(subscription);
    } else {
      CallbackHelper.triggerCallback(executionReturn, callback);
    }
  }

  private resolvedBeforeListenerBy: T | undefined;
  private listener: ((data: T) => void) | undefined;
  private trigger(data: T): void {
    if (!this.destroyed) {
      if (this.listener) {
        this.listener(data);
      } else {
        this.resolvedBeforeListenerBy = data;
      }
    }
  }

  private subscribe<K>(callback: StreamTouchFunction<T, K>): void {
    if (this.destroyed) {
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
