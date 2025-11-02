import { Attachable, IAttachable, IAttachment } from '../attachable/attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T = void> = Notifier<T> | Sequence<T>;

type SequencePipelineItem<A, B> = (data: A, callback: (returnData: B) => void) => void;

type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

export interface ISequenceExecutor extends IAttachable {
  final(): void;
}

class SequenceExecuter extends Attachable implements ISequenceExecutor {
  onDestroyListeners = new Set<() => void>();

  private _pipeline: SequencePipelineItem<unknown, unknown>[] = [];
  private _pendingValues: unknown[] | undefined;

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      let listeners = [...this.onDestroyListeners];
      this.onDestroyListeners.clear();
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]();
      }
    }
  }

  trigger(data: unknown, index = 0): void {
    if (!this.destroyed) {
      if (index < this._pipeline.length) {
        let item = this._pipeline[index];
        item(data, returnData => this.trigger(returnData, index + 1));
      } else if (!this.attachIsCalled) {
        if (!this._pendingValues) {
          this._pendingValues = [];
        }
        this._pendingValues.push(data);
      }
    }
  }

  enterPipeline<A, B>(item: SequencePipelineItem<A, B>) {
    if (!this.destroyed) {
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
          this.trigger(value, itemIndex);
        }
      }
    }
  }

  final() {}

  attach(parent: IAttachable | string): this {
    this._pendingValues = undefined;
    return super.attach(parent);
  }

  attachToRoot(): this {
    this._pendingValues = undefined;
    return super.attachToRoot();
  }
}

export class Sequence<T = void> implements IAttachment {
  static merge<S>(...streams: IStream<S>[]): Sequence<S> {
    let activeSequences = this.validateAndConvertToSet(streams);

    let subscriptions: IAttachment[] = [];
    let mergedSequence = Sequence.create<S>(resolve => {
      streams.forEach(stream => {
        let subscription = stream.subscribe(resolve).attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      });
      return () => subscriptions.forEach(subscription => subscription.destroy());
    });

    this.waitUntilAllSequencedDestroyed(activeSequences, () => mergedSequence.destroy());
    return mergedSequence;
  }

  static combine<const S extends readonly IStream<any>[]>(streams: S): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, IStream<any>>>(streamsObject: S): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, IStream<any>> | readonly IStream<any>[]>(input: S): Sequence<any> {
    let streams = Object.values(streamsObject);
    let activeStreams = this.validateAndConvertToSet(streams);

    let latestValues: any = {};
    let keys = Object.keys(streamsObject);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachment[] = [];
    let combinedSequence = Sequence.create<{ [K in keyof S]: S[K] extends Sequence<infer U> ? U : never }>(resolve => {
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

  private static shallowCopy<S extends object>(obj: S): S {
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

  static create<S = void>(
    executor: (resolve: (data: S) => void, sequenceExecutor: ISequenceExecutor) => (() => void) | void
  ): Sequence<S> {
    let sequenceExecutor = new SequenceExecuter();

    try {
      let destroyCallback = executor(sequenceExecutor.trigger.bind(sequenceExecutor), sequenceExecutor);
      if (destroyCallback) {
        sequenceExecutor.onDestroyListeners.add(destroyCallback);
      }
    } catch (e) {
      console.error(e);
    }

    return new Sequence<S>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this.executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this.executor.attachIsCalled;
  }

  private linked = false;
  private constructor(private executor: SequenceExecuter) {}

  read(callback: (data: T, sequenceExecutor: ISequenceExecutor) => void): Sequence<T> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, T>((data, resolve) => {
      try {
        callback(data, this.executor);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });
    return new Sequence<T>(this.executor);
  }

  filter(callback: (data: T, previousValue: T | undefined, sequenceExecutor: ISequenceExecutor) => boolean): Sequence<T> {
    this.prepareToBeLinked();

    let previousValue: T | undefined;
    this.executor.enterPipeline<T, T>((data, resolve) => {
      let response: boolean;
      try {
        response = callback(data, previousValue, this.executor);
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

  map<K>(
    callback: (data: T, sequenceExecutor: ISequenceExecutor) => K | IStream<K>,
    partialOptions?: Partial<{ blockToEnsureCallOrder: boolean }>
  ): Sequence<K> {
    this.prepareToBeLinked();

    let options = {
      blockToEnsureCallOrder: true,
      ...partialOptions
    };

    this.executor.enterPipeline<T, K>((data, resolve) => {
      let executionReturn: K | IStream<K>;

      try {
        executionReturn = callback(data, this.executor);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      if (executionReturn && typeof executionReturn === 'object' && 'subscribe' in executionReturn) {
        // instanceof is a relativly costly operation, before going that direction we need to rule out majority of sync returns
        if (executionReturn instanceof Notifier || executionReturn instanceof Sequence) {
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
  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    return this.read(callback);
  }

  destroy(): void {
    this.executor.destroy();
  }

  attach(parent: IAttachable | string): this {
    this.executor.attach(parent);
    return this;
  }

  attachToRoot(): this {
    this.executor.attachToRoot();
    return this;
  }
}

/** @internal */
export const SequenceClassNameForMemoryLeakTest = SequenceExecuter.name;
