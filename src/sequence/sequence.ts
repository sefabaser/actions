import { IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { CallbackHelper } from '../helpers/callback.helper';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T> = Notifier<T> | Sequence<T>;
export type SequenceTouchFunction<T, K> = (data: T) => K | IStream<K>;

export class Sequence<T> extends LightweightAttachable {
  static merge<T>(...streams: IStream<T>[]): Sequence<T> {
    let activeSequences = this.validateAndConvertToSet(streams);

    let subscriptions: IAttachable[] = [];
    let mergedSequence = new Sequence<T>(
      resolve => {
        streams.forEach(stream => {
          let subscription = stream
            .subscribe(data => {
              resolve(data);
            })
            .attachToRoot(); // Each handled manually
          subscriptions.push(subscription);
        });
      },
      () => subscriptions.forEach(subscription => subscription.destroy())
    );

    this.waitUntilAllSequencedDestroyed(activeSequences, () => mergedSequence.destroyEndOfSequence());

    return mergedSequence;
  }

  static combine<T extends Record<string, IStream<any>>>(
    streamsObject: T
  ): Sequence<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : T[K] extends Notifier<infer U> ? U : never }> {
    let streams = Object.values(streamsObject);
    let activeStreams = this.validateAndConvertToSet(streams);

    let latestValues: any = {};
    let keys = Object.keys(streamsObject);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachable[] = [];
    let combinedSequence = new Sequence<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : never }>(
      resolve => {
        keys.forEach(key => {
          let stream = streamsObject[key];
          let subscription = stream
            .subscribe(data => {
              latestValues[key] = data;
              if (unresolvedKeys.size === 0) {
                resolve(this.shallowCopy(latestValues));
              } else {
                unresolvedKeys.delete(key);
                if (unresolvedKeys.size === 0) {
                  resolve(this.shallowCopy(latestValues));
                }
              }
            })
            .attachToRoot(); // Each handled manually
          subscriptions.push(subscription);
        });
      },
      () => subscriptions.forEach(subscription => subscription.destroy())
    );

    this.waitUntilAllSequencedDestroyed(activeStreams, () => combinedSequence.destroyEndOfSequence());

    return combinedSequence;
  }

  private static shallowCopy<T extends object>(obj: T): T {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = (obj as any)[key];
      return acc;
    }, {} as any);
  }

  private static validateAndConvertToSet(streams: IStream<unknown>[]) {
    let streamsSet = new Set(streams);
    if (streamsSet.size !== streams.length) {
      streams.forEach(stream => {
        if (stream instanceof Sequence) {
          stream._attachIsCalled = true;
        }
      });
      throw new Error('Each given sequence to merge or combine has to be diferent.');
    }
    return streamsSet;
  }

  private static waitUntilAllSequencedDestroyed(streams: Set<IStream<unknown>>, callback: () => void): void {
    let notifierFound = false;
    streams.forEach(stream => {
      if (stream instanceof Notifier) {
        notifierFound = true;
      }
    });

    if (!notifierFound) {
      let sequences = streams as Set<Sequence<unknown>>;

      let oneDestroyed = (sequence: Sequence<unknown>) => {
        sequences.delete(sequence);
        if (sequences.size === 0) {
          callback();
        }
      };

      sequences.forEach(sequence => {
        if (sequence.destroyed) {
          oneDestroyed(sequence);
        } else {
          sequence._onDestroyListeners.add(() => oneDestroyed(sequence));
        }
      });
    }
  }

  private _nextInLine: Sequence<unknown> | undefined;
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

  private createNextInLine<K>(): Sequence<K> {
    if (this._nextInLine) {
      throw new Error('A sequence can only be linked once.');
    }
    if (this._attachIsCalled) {
      throw new Error('After attaching a sequence you cannot add another operation.');
    }

    let nextInLine = new Sequence<K>(
      () => {},
      () => this.destroy()
    );
    this.attachToRoot(); // Destroying is manually done by listening nextInLine
    this._nextInLine = nextInLine;
    return nextInLine;
  }

  destroy(): void {
    if (!this.destroyed) {
      this._listener = undefined;
      this._resolvedBeforeListenerBy = undefined;
      this._nextInLine = undefined;

      super.destroy();

      this._onDestroyListeners.forEach(item => item());
      this._onDestroyListeners = undefined as any;
    }
  }

  private destroyEndOfSequence(): void {
    let endOfSequence = this.getEndOfSequence();
    if (endOfSequence._attachIsCalled) {
      endOfSequence.destroy();
    } else {
      // The linking has not complete yet, wait for a microtask to all chain to be ready
      queueMicrotask(() => {
        this.getEndOfSequence();
        endOfSequence.destroy();
      });
    }
  }

  private getEndOfSequence(): Sequence<unknown> {
    let endOfSequence: Sequence<unknown> = this;
    while (endOfSequence._nextInLine) {
      endOfSequence = endOfSequence._nextInLine;
    }
    return endOfSequence;
  }

  private waitUntilExecution<K>(data: T, executionCallback: SequenceTouchFunction<T, K>, callback: (data: K) => void): void {
    let executionReturn = executionCallback(data);
    if (executionReturn instanceof Sequence || executionReturn instanceof Notifier) {
      let destroyedDirectly = false;
      let destroyListener = () => subscription.destroy();

      let subscription: { destroy: () => void } = undefined as any;
      subscription = executionReturn
        .subscribe(innerData => {
          if (subscription) {
            subscription.destroy();
            this._onDestroyListeners.delete(destroyListener);
          } else {
            destroyedDirectly = true;
          }
          CallbackHelper.triggerCallback(innerData, callback);
        })
        .attachToRoot();
      if (!destroyedDirectly) {
        this._onDestroyListeners.add(destroyListener);
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

  /** @internal */
  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
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
    return this;
  }
}
