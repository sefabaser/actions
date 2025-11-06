import { Comparator, Queue } from 'helpers-lib';

import { Attachable, IAttachable, IAttachment } from '../attachable/attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T = void> = Notifier<T> | Sequence<T>;

type SequencePipelineItem<A, B> = (data: A, context: ISequenceContext, callback: (returnData: B) => void) => void;
type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

export interface ISequenceCreatorContext {
  attachable: IAttachable;
  final(): void;
}

export interface ISequenceContext {
  attachable: IAttachable;
  final(): void;
  drop(): void;
}

class SequenceContext implements ISequenceContext {
  private _attachable?: IAttachable;
  get attachable(): IAttachable {
    if (!this._attachable) {
      this._attachable = new Attachable().attach(this.executor);
    }
    return this._attachable;
  }

  constructor(
    private executor: SequenceExecuter,
    public final: () => void,
    public drop: () => void
  ) {}

  destroy() {
    this._attachable?.destroy();
  }
}

class SequencePackage {
  data: unknown;
  pipelineIndex = 0;
  ongoingContext?: SequenceContext;
  behind?: SequencePackage;
  forward?: SequencePackage;

  destroy() {
    this.ongoingContext?.destroy();
  }
}

type ExecutionOrderQueuer =
  | {
      callback: () => void;
    }
  | Record<string, never>;

class SequenceExecuter extends Attachable {
  onDestroyListeners = new Set<() => void>();

  private _pipeline: SequencePipelineItem<unknown, unknown>[] = [];
  private _pendingPackages = new Queue<SequencePackage>();
  private _finalized?: boolean;
  private _headPackage?: SequencePackage;
  private _tailPackage?: SequencePackage;

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._headPackage = undefined;
      this._tailPackage = undefined;
      this._pendingPackages = undefined as any;

      let listeners = [...this.onDestroyListeners];
      this.onDestroyListeners.clear();
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]();
      }
    }
  }

  trigger(data: unknown): void {
    if (!this._finalized && !this.destroyed) {
      let sequencePackage = this.createPackageToEnd();
      sequencePackage.data = data;
      // console.log(data, ' + initial trigger');
      this.iteratePackage(sequencePackage);
    }
  }

  enterPipeline<A, B>(item: SequencePipelineItem<A, B>) {
    if (!this.destroyed) {
      if (this.attachIsCalled) {
        throw new Error('After attaching a sequence you cannot add another operation.');
      }

      this._pipeline.push(item);

      // console.log('-> enter pipeline', this._pendingPackages.isEmpty ? ' no pending' : ' some pending');
      let pendingPackages = this._pendingPackages;
      this._pendingPackages = new Queue();
      while (!pendingPackages.isEmpty) {
        let pendingPackage = pendingPackages.pop()!;
        this.iteratePackage(pendingPackage);
      }
    }
  }

  final(sequencePackage?: SequencePackage) {
    // console.log('final');
    if (this.attachIsCalled && this.isPipelineEmpty()) {
      this.destroy();
    } else {
      this._finalized = true;
      if (sequencePackage) {
        this.destroyAllPackagesBehind(sequencePackage);
      }
    }
  }

  attach(parent: IAttachable | string): this {
    this.onAttach();
    return super.attach(parent);
  }

  attachToRoot(): this {
    this.onAttach();
    return super.attachToRoot();
  }

  private isPipelineEmpty(): boolean {
    return this._headPackage === undefined;
  }

  private createPackageToEnd(): SequencePackage {
    let sequencePackage = new SequencePackage();
    if (!this._tailPackage) {
      this._headPackage = sequencePackage;
      this._tailPackage = sequencePackage;
    } else {
      this._tailPackage.behind = sequencePackage;
      sequencePackage.forward = this._tailPackage;
      this._tailPackage = sequencePackage;
    }
    return sequencePackage;
  }

  private destroyPackage(sequencePackage: SequencePackage): void {
    if (sequencePackage.behind) {
      sequencePackage.behind.forward = sequencePackage.forward;
    }
    if (sequencePackage.forward) {
      sequencePackage.forward.behind = sequencePackage.behind;
    }
    if (this._tailPackage === sequencePackage) {
      this._tailPackage = sequencePackage.forward;
    }
    if (this._headPackage === sequencePackage) {
      this._headPackage = sequencePackage.behind;
    }

    sequencePackage.destroy();
  }

  private destroyAllPackagesBehind(sequencePackage: SequencePackage): void {
    let iteratedPackage = sequencePackage.behind;
    while (iteratedPackage) {
      iteratedPackage.destroy();
      iteratedPackage = iteratedPackage.behind;
    }

    sequencePackage.behind = undefined;
    this._tailPackage = sequencePackage;
  }

  private onAttach(): void {
    while (!this._pendingPackages.isEmpty) {
      let pendingPackage = this._pendingPackages.pop()!;
      this.destroyPackage(pendingPackage);
    }

    if (this._finalized && this.isPipelineEmpty()) {
      // console.log('attach destroy');
      this.destroy();
    }
  }

  private iteratePackage(sequencePackage: SequencePackage): void {
    if (!this.destroyed) {
      if (sequencePackage.pipelineIndex < this._pipeline.length) {
        // console.log('iterate ', sequencePackage.data, sequencePackage.pipelineIndex);

        let pipelineItem = this._pipeline[sequencePackage.pipelineIndex];

        let context = new SequenceContext(
          this,
          () => {
            this.final(sequencePackage);
          },
          () => {
            this.destroyPackage(sequencePackage);
          }
        );
        sequencePackage.ongoingContext = context;

        pipelineItem(sequencePackage.data, context, returnData => {
          context.destroy();
          sequencePackage.ongoingContext = undefined;

          sequencePackage.data = returnData;
          sequencePackage.pipelineIndex++;
          this.iteratePackage(sequencePackage);
        });
      } else {
        // console.log('end of pipeline ', sequencePackage.data, sequencePackage.pipelineIndex, this._pipeline.length);
        if (!this.attachIsCalled) {
          this._pendingPackages.add(sequencePackage);
        } else {
          // console.log('package destroy');
          if (this._headPackage !== sequencePackage) {
            throw new Error('Sequence: Internal Error! Iterated package that hits the finish should have been the head package.');
          } else {
            if (this._tailPackage === this._headPackage) {
              // This package is the only remaining one
              if (this._finalized) {
                // console.log('conclude destroy');
                this.destroy();
              } else {
                this._headPackage = undefined;
                this._tailPackage = undefined;
              }
            } else {
              if (sequencePackage.behind) {
                this._headPackage = sequencePackage.behind;
                this._headPackage.forward = undefined;
              }
            }
          }
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

  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISequenceCreatorContext) => (() => void) | void
  ): Sequence<S> {
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

    this.executor.enterPipeline<T, T>((data, context, resolve) => {
      try {
        callback(data, context);
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
    this.executor.enterPipeline<T, T>((data, context, resolve) => {
      let passedTheFilter: boolean;
      try {
        passedTheFilter = callback(data, previousValue, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      if (passedTheFilter) {
        resolve(data);
        previousValue = data;
      } else {
        context.drop();
      }
    });
    return new Sequence<T>(this.executor);
  }

  take(count: number): Sequence<T> {
    this.prepareToBeLinked();

    let taken = 0;

    this.executor.enterPipeline<T, T>((data, context, resolve) => {
      taken++;

      if (taken >= count) {
        context.final();
      }

      if (taken <= count) {
        resolve(data);
      }
    });

    return new Sequence<T>(this.executor);
  }

  asyncMap<K>(callback: (data: T, context: ISequenceContext) => K | IStream<K>): Sequence<K> {
    this.prepareToBeLinked();

    let queue = new Queue<ExecutionOrderQueuer>();
    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: K | IStream<K>;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      if (executionReturn && typeof executionReturn === 'object' && 'subscribe' in executionReturn) {
        // instanceof is a relativly costly operation, before going that direction we need to rule out majority of sync returns
        if (executionReturn instanceof Notifier || executionReturn instanceof Sequence) {
          // console.log(' returned stream');

          let queuer: ExecutionOrderQueuer = {};
          queue.add(queuer);

          executionReturn
            .subscribe(resolvedData => {
              // console.log('*** ', resolvedData);
              queuer.callback = () => resolve(resolvedData);

              if (queue.peek() === queuer) {
                // console.log('       it is the next in queue');
                queue.pop();
                resolve(resolvedData);

                while (queue.peek()?.callback) {
                  queue.pop()?.callback();
                }
              } else {
                queuer.callback = () => resolve(resolvedData);
              }
            })
            .attach(context.attachable);
        } else {
          if (queue.isEmpty) {
            resolve(executionReturn);
          } else {
            queue.add({
              callback: () => resolve(executionReturn as K)
            });
          }
        }
      } else {
        if (queue.isEmpty) {
          resolve(executionReturn);
        } else {
          queue.add({
            callback: () => resolve(executionReturn as K)
          });
        }
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
    // console.log('// attach');
    this.executor.attach(parent);
    return this;
  }

  attachToRoot(): this {
    // console.log('// attach');
    this.executor.attachToRoot();
    return this;
  }
}

/** @internal */
export const SequencePackageClassName = SequencePackage.name;
/** @internal */
export const SequenceClassNames = [
  Sequence.name,
  SequenceExecuter.name,
  SequencePackage.name,
  SequenceContext.name,
  Queue.name,
  'DoublyLinkedListNode'
];
