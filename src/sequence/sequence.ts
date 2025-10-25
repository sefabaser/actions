import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { CallbackHelper } from '../helpers/callback.helper';
import { Notifier } from '../observables/_notifier/notifier';
import { Action } from '../observables/action/action';

export type SequenceTouchFunction<T, K> = (data: T) => K | Sequence<K> | Notifier<K>;

export class Sequence<T> extends LightweightAttachable {
  static merge<T>(...sequences: Sequence<T>[]): Sequence<T> {
    let activeSequences = this.convertToSet(sequences);

    let mergedSequence = new Sequence<T>(
      resolve => {
        sequences.forEach(sequence => {
          sequence.subscribe(data => {
            resolve(data);
          });
        });
      },
      () => sequences.forEach(sequence => sequence.destroy())
    );

    sequences.forEach(sequence => sequence.attachToRoot()); // Each handled manually
    this.waitUntilAllSequencedDestroyed(activeSequences, () => mergedSequence.destroyEndOfSequence());

    return mergedSequence;
  }

  static combine<T extends Record<string, Sequence<any>>>(
    sequencesObject: T
  ): Sequence<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : never }> {
    let sequences = Object.values(sequencesObject);
    let activeSequences = this.convertToSet(sequences);

    let latestValues: any = {};
    let unresolvedKeys = new Set(Object.keys(sequencesObject));

    let combinedSequence = new Sequence<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : never }>(
      resolve => {
        Object.keys(sequencesObject).forEach(key => {
          let sequence = sequencesObject[key];
          sequence.subscribe(data => {
            latestValues[key] = data;
            if (unresolvedKeys.size === 0) {
              resolve(this.shallowCopy(latestValues));
            } else {
              unresolvedKeys.delete(key);
              if (unresolvedKeys.size === 0) {
                resolve(this.shallowCopy(latestValues));
              }
            }
          });
        });
      },
      () => sequences.forEach(sequence => sequence.destroy())
    );

    sequences.forEach(sequence => sequence.attachToRoot()); // Each handled manually
    this.waitUntilAllSequencedDestroyed(activeSequences, () => combinedSequence.destroyEndOfSequence());

    return combinedSequence;
  }

  private static shallowCopy<T extends object>(obj: T): T {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = (obj as any)[key];
      return acc;
    }, {} as any);
  }

  private static convertToSet(sequences: Sequence<unknown>[]) {
    let sequencesSet = new Set(sequences);
    if (sequencesSet.size !== sequences.length) {
      sequences.forEach(sequence => {
        // Prevent attachment error before sending the real error.
        sequence._attachIsCalled = true;
      });
      throw new Error('Each given sequence to merge or combine has to be diferent.');
    }
    return sequencesSet;
  }

  private static waitUntilAllSequencedDestroyed(sequences: Set<Sequence<unknown>>, callback: () => void): void {
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
    if (executionReturn instanceof Sequence) {
      let executionSequence: Sequence<K> = executionReturn;
      let destroyListener = () => executionSequence.destroy();
      executionSequence.subscribe(innerData => {
        this._onDestroyListeners.delete(destroyListener);
        destroyListener();
        CallbackHelper.triggerCallback(innerData, callback);
      });
      this._onDestroyListeners.add(destroyListener);
      executionSequence.attachToRoot(); // destoying is manually done
    } else if (executionReturn instanceof Notifier) {
      let executionNotifier: Notifier<K> = executionReturn;

      let destroyedDirectly = false;
      let subscription = executionNotifier
        .subscribe(innerData => {
          if (subscription) {
            subscription.destroy();
          } else {
            destroyedDirectly = true;
          }
          CallbackHelper.triggerCallback(innerData, callback);
        })
        .attachToRoot(); // destoying is manually done
      if (!destroyedDirectly) {
        this._onDestroyListeners.add(() => subscription.destroy());
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
