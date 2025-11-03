import { Comparator } from 'helpers-lib';

import { Attachable, IAttachable, IAttachment } from '../attachable/attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T = void> = Notifier<T> | Sequence<T>;

type SequencePipelineItem<A, B> = (data: A, sequencePackage: SequencePackage, callback: (returnData: B) => void) => void;
type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

export interface ISequenceContext {
  attachable: IAttachable;
  final(): void;
}

class SequenceContext implements ISequenceContext {
  private _attachable?: IAttachable;
  get attachable(): IAttachable {
    // TODO: test performance lazy vs prebuild.
    if (!this._attachable) {
      this._attachable = new Attachable();
    }
    return this._attachable;
  }

  constructor(private sequencePackage: SequencePackage) {}

  final(): void {
    this.sequencePackage.executor.final(this.sequencePackage);
  }
}

class SequencePackage {
  readonly context: SequenceContext;

  data: unknown;
  pipelineIndex = 0;
  behind?: SequencePackage;

  constructor(public executor: SequenceExecuter) {
    this.context = new SequenceContext(this);
  }

  destroy(): void {
    this.context['_attachable']?.destroy();
  }
}

class SequenceExecuter extends Attachable {
  onDestroyListeners = new Set<() => void>();

  private _pipeline: SequencePipelineItem<unknown, unknown>[] = [];
  private _pendingPackages: SequencePackage[] | undefined;
  private _finalized?: boolean;
  private _tailPackage?: SequencePackage;

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._pendingPackages = undefined;

      let listeners = [...this.onDestroyListeners];
      this.onDestroyListeners.clear();
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]();
      }
    }
  }

  trigger(data: unknown): void {
    if (!this._finalized) {
      let sequencePackage = new SequencePackage(this);
      if (this._tailPackage) {
        this._tailPackage.behind = sequencePackage;
      } else {
        this._tailPackage = sequencePackage;
      }

      sequencePackage.data = data;
      console.log(!!this._tailPackage, ' + initial trigger');
      this.iteratePackage(sequencePackage);
    }
  }

  enterPipeline<A, B>(item: SequencePipelineItem<A, B>) {
    if (!this.destroyed) {
      if (this.attachIsCalled) {
        throw new Error('After attaching a sequence you cannot add another operation.');
      }

      this._pipeline.push(item);
      if (this._pendingPackages) {
        let pendingPackages = this._pendingPackages;
        this._pendingPackages = [];

        for (let i = 0; i < pendingPackages.length; i++) {
          console.log(!!this._tailPackage, ' + pending sequencePackage');
          this.iteratePackage(pendingPackages[i]);
        }
      }
    }
  }

  final(sequencePackage?: SequencePackage) {
    console.log('final');
    this._finalized = true;
    if (this._tailPackage === undefined && this.attachIsCalled) {
      console.log('final destroy');
      this.destroy();
    }
  }

  attach(parent: IAttachable | string): this {
    this._pendingPackages = undefined;
    if (this._finalized && this._tailPackage === undefined) {
      console.log('attach destroy');
      this.destroy();
    }
    return super.attach(parent);
  }

  attachToRoot(): this {
    this._pendingPackages = undefined;
    if (this._finalized && this._tailPackage === undefined) {
      console.log('attach to root destroy');
      this.destroy();
    }
    return super.attachToRoot();
  }

  private iteratePackage(sequencePackage: SequencePackage): void {
    if (!this.destroyed) {
      if (sequencePackage.pipelineIndex < this._pipeline.length) {
        let pipelineItem = this._pipeline[sequencePackage.pipelineIndex];
        sequencePackage.pipelineIndex++;
        pipelineItem(sequencePackage.data, sequencePackage, returnData => {
          sequencePackage.data = returnData;
          this.iteratePackage(sequencePackage);
        });
      } else {
        if (!this.attachIsCalled) {
          if (!this._pendingPackages) {
            this._pendingPackages = [];
          }
          sequencePackage.pipelineIndex++;
          this._pendingPackages.push(sequencePackage);
        }

        sequencePackage.destroy();
        if (this._tailPackage === sequencePackage) {
          this._tailPackage = undefined;
        }

        console.log(!!this._tailPackage, ' - conclude', this._finalized, this.attachIsCalled);
        if (this._finalized && this._tailPackage === undefined && this.attachIsCalled) {
          console.log('conclude destroy');
          this.destroy();
        }
      }
    }
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

    this.waitUntilAllSequencesDestroyed(activeSequences, () => mergedSequence.executor.final());
    return mergedSequence;
  }

  static combine<const S extends readonly IStream<any>[]>(streams: S): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, IStream<any>>>(streamsObject: S): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, IStream<any>> | readonly IStream<any>[]>(input: S): Sequence<any> {
    let isArray = Comparator.isArray(input);
    let streams = Object.values(input);
    let activeStreams = this.validateAndConvertToSet(streams);

    let latestValues: any = isArray ? [] : {};
    let keys = Object.keys(input);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachment[] = [];
    let combinedSequence = Sequence.create<{ [K in keyof S]: S[K] extends Sequence<infer U> ? U : never }>(resolve => {
      keys.forEach(key => {
        let stream = (input as any)[key];
        let subscription = stream
          .subscribe((data: any) => {
            latestValues[key] = data;
            if (unresolvedKeys.size === 0) {
              resolve(isArray ? [...latestValues] : this.shallowCopy(latestValues));
            } else {
              unresolvedKeys.delete(key);
              if (unresolvedKeys.size === 0) {
                resolve(isArray ? [...latestValues] : this.shallowCopy(latestValues));
              }
            }
          })
          .attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      });

      return () => subscriptions.forEach(subscription => subscription.destroy());
    });

    this.waitUntilAllSequencesDestroyed(activeStreams, () => combinedSequence.executor.final());

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

  private static waitUntilAllSequencesDestroyed(streams: Set<IStream<unknown>>, callback: () => void): void {
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

  static create<S = void>(executor: (resolve: (data: S) => void, context: ISequenceContext) => (() => void) | void): Sequence<S> {
    let sequenceExecutor = new SequenceExecuter();

    try {
      let destroyCallback = executor(sequenceExecutor.trigger.bind(sequenceExecutor), {
        attachable: sequenceExecutor,
        final: sequenceExecutor.final.bind(sequenceExecutor)
      });
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

  read(callback: (data: T, context: ISequenceContext) => void): Sequence<T> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, T>((data, sequencePackage, resolve) => {
      try {
        callback(data, sequencePackage.context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });
    return new Sequence<T>(this.executor);
  }

  filter(callback: (data: T, previousValue: T | undefined, context: ISequenceContext) => boolean): Sequence<T> {
    this.prepareToBeLinked();

    let previousValue: T | undefined;
    this.executor.enterPipeline<T, T>((data, sequencePackage, resolve) => {
      let response: boolean;
      try {
        response = callback(data, previousValue, sequencePackage.context);
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

    this.executor.enterPipeline<T, T>((data, sequencePackage, resolve) => {
      taken++;

      if (taken >= count) {
        this.executor.final(sequencePackage);
      }

      if (taken <= count) {
        resolve(data);
      }
    });

    return new Sequence<T>(this.executor);
  }

  map<K>(
    callback: (data: T, context: ISequenceContext) => K | IStream<K>,
    partialOptions?: Partial<{ blockToEnsureCallOrder: boolean }>
  ): Sequence<K> {
    this.prepareToBeLinked();

    let options = {
      blockToEnsureCallOrder: true,
      ...partialOptions
    };

    this.executor.enterPipeline<T, K>((data, sequencePackage, resolve) => {
      let executionReturn: K | IStream<K>;

      try {
        executionReturn = callback(data, sequencePackage.context);
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
export const ClassNamesForMemoryLeakTest = [SequenceExecuter.name, SequencePackage.name, SequenceContext.name];
