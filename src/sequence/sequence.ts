import { Attachable, IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T> = Notifier<T> | Sequence<T>;

type SequencePipelineItem<A, B> = (data: A, callback: (returnData: B) => void) => void;

class SequenceExecuter extends LightweightAttachable {
  onDestroyListeners = new Set<() => void>();

  private _pipeline: SequencePipelineItem<unknown, unknown>[] = [];
  private _pendingValues: unknown[] | undefined;

  destroy(): void {
    if (!this.destroyed) {
      if (this.attachIsCalled) {
        this._pipeline = undefined as any;
      }

      super.destroy();

      for (let item of this.onDestroyListeners) {
        item();
      }
      this.onDestroyListeners.clear();
    }
  }

  trigger(data: unknown, index = 0, checkDestroyed = true): void {
    if (!this.destroyed || !checkDestroyed) {
      if (index < this._pipeline.length) {
        let item = this._pipeline[index];
        item(data, returnData => this.trigger(returnData, index + 1));
      } else {
        if (!this.attachIsCalled) {
          if (!this._pendingValues) {
            this._pendingValues = [];
          }
          this._pendingValues.push(data);
        }
      }
    }
  }

  enterPipeline<A, B>(item: SequencePipelineItem<A, B>) {
    if (this.attachIsCalled) {
      throw new Error('After attaching a sequence you cannot add another operation.');
    }

    this._pipeline.push(item);
    if (this._pendingValues) {
      let pendingValues = this._pendingValues;
      this._pendingValues = [];
      let itemIndex = this._pipeline.length - 1;

      for (let i = 0; i < pendingValues.length; i++) {
        let value = pendingValues[i];
        this.trigger(value, itemIndex, false);
      }
    }
  }

  attach(parent: string | Attachable): this {
    this._pendingValues = undefined;
    if (this.destroyed) {
      this._pipeline = undefined as any;
    }
    return super.attach(parent);
  }

  attachToRoot(): this {
    this._pendingValues = undefined;
    if (this.destroyed) {
      this._pipeline = undefined as any;
    }
    return super.attachToRoot();
  }
}

export class Sequence<T = void> implements IAttachable {
  static merge<T>(...streams: IStream<T>[]): Sequence<T> {
    let activeSequences = this.validateAndConvertToSet(streams);

    let subscriptions: IAttachable[] = [];
    let mergedSequence = Sequence.create<T>(resolve => {
      streams.forEach(stream => {
        let subscription = stream.subscribe(resolve).attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      });
      return () => subscriptions.forEach(subscription => subscription.destroy());
    });

    this.waitUntilAllSequencedDestroyed(activeSequences, () => mergedSequence.destroy());
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
    let combinedSequence = Sequence.create<{ [K in keyof T]: T[K] extends Sequence<infer U> ? U : never }>(resolve => {
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

      return () => subscriptions.forEach(subscription => subscription.destroy());
    });

    this.waitUntilAllSequencedDestroyed(activeStreams, () => combinedSequence.destroy());

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
          stream.executor['_attachIsCalled'] = true;
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
          sequence.executor.onDestroyListeners.add(() => oneDestroyed(sequence));
        }
      });
    }
  }

  static create<T = void>(executor: (resolve: (data: T) => void) => (() => void) | void): Sequence<T> {
    let sequenceExecutor = new SequenceExecuter();

    try {
      let destroyCallback = executor(sequenceExecutor.trigger.bind(sequenceExecutor));
      if (destroyCallback) {
        sequenceExecutor.onDestroyListeners.add(destroyCallback);
      }
    } catch (e) {
      console.error(e);
    }

    return new Sequence<T>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this.executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this.executor.attachIsCalled;
  }

  private linked = false;
  private constructor(private executor: SequenceExecuter) {}

  read(callback: (data: T) => void): Sequence<T> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, T>((data, resolve) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });
    return new Sequence<T>(this.executor);
  }

  filter(callback: (data: T, previousValue: T | undefined) => boolean): Sequence<T> {
    this.prepareToBeLinked();

    let previousValue: T | undefined;
    this.executor.enterPipeline<T, T>((data, resolve) => {
      let response: boolean;
      try {
        response = callback(data, previousValue);
        previousValue = data;
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      if (response) {
        resolve(data);
      }
    });
    return new Sequence<T>(this.executor);
  }

  take(count: number): Sequence<T> {
    this.prepareToBeLinked();

    let taken = 0;

    this.executor.enterPipeline<T, T>((data, resolve) => {
      if (taken < count) {
        resolve(data);
        taken++;
      }

      if (taken >= count) {
        this.executor.destroy();
      }
    });

    return new Sequence<T>(this.executor);
  }

  map<K>(callback: (data: T) => K | IStream<K>): Sequence<K> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, K>((data, resolve) => {
      let executionReturn: K | IStream<K>;

      try {
        executionReturn = callback(data);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      if (executionReturn instanceof Sequence || executionReturn instanceof Notifier) {
        let destroyedDirectly = false;
        let destroyListener = () => subscription.destroy();

        let subscription: { destroy: () => void } = undefined as any;
        subscription = executionReturn
          .subscribe(innerData => {
            if (subscription) {
              subscription.destroy();
              this.executor.onDestroyListeners.delete(destroyListener);
            } else {
              destroyedDirectly = true;
            }

            resolve(innerData);
          })
          .attachToRoot();
        if (!destroyedDirectly) {
          this.executor.onDestroyListeners.add(destroyListener);
        }
      } else {
        resolve(executionReturn);
      }
    });

    return new Sequence<K>(this.executor);
  }

  private prepareToBeLinked(): void {
    if (this.linked) {
      throw new Error('A sequence can only be linked once.');
    }
    this.linked = true;
  }

  /** @internal */
  subscribe(callback: NotifierCallbackFunction<T>): IAttachable {
    return this.read(callback);
  }

  destroy(): void {
    this.executor.destroy();
  }

  attach(parent: string | Attachable): this {
    this.executor.attach(parent);
    return this;
  }

  attachToRoot(): this {
    this.executor.attachToRoot();
    return this;
  }
}
