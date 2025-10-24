import { IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { CallbackHelper } from '../helpers/callback.helper';
import { Notifier } from '../observables/_notifier/notifier';

export type StreamTouchFunction<T, K> = (data: T) => K | Stream2<K> | Notifier<K>;

const NO_DATA = Symbol('NO_DATA');

export class Stream2<T> extends LightweightAttachable {
  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    super();
    executor(data => this.trigger(data));
  }

  tap<K>(callback: StreamTouchFunction<T, K>): Stream2<K> {
    let nextInLine = new Stream2<K>(
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
      this.resolvedBeforeListenerBy = NO_DATA;
      this.toBeDestroyed.forEach(item => item.destroy());
      this.toBeDestroyed.clear();
      this._toBeDestroyed = undefined;
      this.onDestroy?.();
      this.onDestroy = undefined;
      super.destroy();
    }
  }

  private waitUntilExecution<K>(data: T, executionCallback: StreamTouchFunction<T, K>, callback: (data: K) => void): void {
    let executionReturn = executionCallback(data);
    if (executionReturn instanceof Stream2) {
      let executionStream: Stream2<K> = executionReturn;
      executionStream.subscribe(innerData => {
        this.toBeDestroyed.delete(executionStream);
        executionStream.destroy();
        CallbackHelper.triggerCallback(innerData, callback);
      });
      this.toBeDestroyed.add(executionStream);
      executionStream.attachToRoot(); // destoying is manually done
    } else if (executionReturn instanceof Notifier) {
      let executionNotifier: Notifier<K> = executionReturn;

      let destroyedDirectly = false;
      let subscription = executionNotifier
        .subscribe(innerData => {
          if (subscription) {
            subscription.destroy();
            this.toBeDestroyed.delete(subscription);
          } else {
            destroyedDirectly = true;
          }
          CallbackHelper.triggerCallback(innerData, callback);
        })
        .attachToRoot(); // destoying is manually done
      if (!destroyedDirectly) {
        this.toBeDestroyed.add(subscription);
      }
    } else {
      CallbackHelper.triggerCallback(executionReturn, callback);
    }
  }

  private resolvedBeforeListenerBy: T | typeof NO_DATA = NO_DATA;
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

    if (this.resolvedBeforeListenerBy !== NO_DATA) {
      callback(this.resolvedBeforeListenerBy);
      this.resolvedBeforeListenerBy = NO_DATA;
    }
    this.listener = data => callback(data);
  }
}
