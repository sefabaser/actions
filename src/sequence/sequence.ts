import { IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { CallbackHelper } from '../helpers/callback.helper';
import { Notifier } from '../observables/_notifier/notifier';
import { Action } from '../observables/action/action';

export type SequenceTouchFunction<T, K> = (data: T) => K | Sequence<K> | Notifier<K>;

export class Sequence<T> extends LightweightAttachable {
  static merge<T>(...sequences: Sequence<T>[]): Sequence<T> {
    sequences.forEach(sequence => {
      sequence.attachToRoot();
    });

    // when all sequences are destroyed, destroy the merge sequence

    return new Sequence<T>(
      resolve => {
        sequences.forEach(sequence => {
          sequence.subscribe(data => {
            resolve(data);
          });
        });
      },
      () => {
        sequences.forEach(sequence => {
          sequence.destroy();
        });
      }
    );
  }

  static combine<T extends Record<string, Sequence<any>>>(
    sequences: T
  ): Sequence<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : never }> {
    throw new Error('Not implemented');
  }

  private _nextInLine: Sequence<unknown> | undefined;
  private _toBeDestroyed: Set<IAttachable> | undefined;
  private _resolvedBeforeListenerBy: T[] | undefined;
  private _listener: ((data: T) => void) | undefined;

  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    super();
    executor(data => this.trigger(data));
  }

  read(callback: (data: T) => void): Sequence<T> {
    let nextInLine = this.createNextInLine<T>();

    this.subscribe(data => {
      callback(data);
      nextInLine.trigger(data);
    });

    return nextInLine;
  }

  map<K>(callback: SequenceTouchFunction<T, K>): Sequence<K> {
    let nextInLine = this.createNextInLine<K>();

    this.subscribe(data => {
      this.waitUntilExecution(data, callback, executionReturn => {
        nextInLine.trigger(executionReturn);
      });
    });

    return nextInLine;
  }

  filter(callback: (data: T) => boolean): Sequence<T> {
    let nextInLine = this.createNextInLine<T>();

    this.subscribe(data => {
      if (callback(data)) {
        nextInLine.trigger(data);
      }
    });

    return nextInLine;
  }

  take(count: number): Sequence<T> {
    let nextInLine = this.createNextInLine<T>();
    let taken = 0;

    this.subscribe(data => {
      nextInLine.trigger(data);
      taken++;
      if (taken >= count) {
        this.destroyEndOfSequence();
      }
    });

    return nextInLine;
  }

  toNotifier(): Notifier<T> {
    if (!this.attachIsCalled) {
      throw new Error('Before converting a sequence to notifier, it must be attached to something!');
    }

    let action = new Action<T>();
    this.subscribe(data => action.trigger(data));
    return action.notifier;
  }

  private createNextInLine<K>(): Sequence<K> {
    if (this._nextInLine) {
      throw new Error('A sequence can only be linked once.');
    }

    let nextInLine = new Sequence<K>(
      () => {},
      () => this.destroy()
    );
    this.attachToRoot(); // Destroying is manually done by listening nextInLine
    this._nextInLine = nextInLine;
    return nextInLine;
  }

  private get toBeDestroyed(): Set<IAttachable> {
    if (!this._toBeDestroyed) {
      this._toBeDestroyed = new Set<IAttachable>();
    }
    return this._toBeDestroyed;
  }

  destroy(): void {
    if (!this.destroyed) {
      this._listener = undefined;
      this._resolvedBeforeListenerBy = undefined;
      this._nextInLine = undefined;

      this.toBeDestroyed.forEach(item => item.destroy());
      this.toBeDestroyed.clear();
      this._toBeDestroyed = undefined;

      this.onDestroy?.();
      this.onDestroy = undefined;

      super.destroy();
    }
  }

  private destroyEndOfSequence(): void {
    queueMicrotask(() => {
      let endOfSequence: Sequence<unknown> = this;
      while (endOfSequence._nextInLine) {
        endOfSequence = endOfSequence._nextInLine;
      }
      endOfSequence.destroy();
    });
  }

  private waitUntilExecution<K>(data: T, executionCallback: SequenceTouchFunction<T, K>, callback: (data: K) => void): void {
    let executionReturn = executionCallback(data);
    if (executionReturn instanceof Sequence) {
      let executionSequence: Sequence<K> = executionReturn;
      executionSequence.subscribe(innerData => {
        this.toBeDestroyed.delete(executionSequence);
        executionSequence.destroy();
        CallbackHelper.triggerCallback(innerData, callback);
      });
      this.toBeDestroyed.add(executionSequence);
      executionSequence.attachToRoot(); // destoying is manually done
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

  private subscribe<K>(callback: SequenceTouchFunction<T, K>): void {
    if (this.destroyed) {
      throw new Error('Sequence is destroyed');
    }
    if (this._listener) {
      throw new Error('Sequence is already being listened to');
    }

    if (this._resolvedBeforeListenerBy && this._resolvedBeforeListenerBy.length > 0) {
      this._resolvedBeforeListenerBy.forEach(data => callback(data));
      this._resolvedBeforeListenerBy = undefined;
    }
    this._listener = data => callback(data);
  }
}
