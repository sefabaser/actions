import { Comparator, Queue } from 'helpers-lib';

import { Attachable, IAttachable, IAttachment } from '../attachable/attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type NotStream<T> = T extends Sequence<any> ? (T extends Notifier<any> ? never : never) : T;
export type StreamType<T = void> = Notifier<T> | Sequence<T>;

type SequencePipelineDestructor = (finalContext?: SequenceContext) => void;
type SequencePipelineIterator<A = unknown, B = unknown> = (
  data: A,
  context: ISequenceLinkContext,
  callback: (returnData: B) => void
) => void;
type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

export interface ISequenceCreatorContext {
  attachable: IAttachable;
  final(): void;
  // TODO: destroy sequence function
}

export interface ISequenceLinkContext {
  attachable: IAttachable;
  final(): void;
  drop(): void;
  // TODO: destroy sequence function
  /** @internal */
  destroyAttachment(): void;
}

class SequenceContext implements ISequenceLinkContext {
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

  /** @internal */
  destroyAttachment() {
    this._attachable?.destroy();
  }
}

class SequencePackage {
  pipelineIndex = 0;
  ongoingContext?: SequenceContext;

  constructor(public data: unknown) {}

  destroy() {
    this.ongoingContext?.destroyAttachment();
  }
}

type ExecutionOrderQueuer = {
  callback?: () => void;
  context: ISequenceLinkContext;
};

class SequenceExecuter extends Attachable {
  private _onDestroyListeners?: Set<() => void>;
  get onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListeners) {
      this._onDestroyListeners = new Set();
    }
    return this._onDestroyListeners;
  }

  private _pipeline: { iterator: SequencePipelineIterator; destructor?: SequencePipelineDestructor }[] = [];
  private _asyncPipelineIndices?: Set<number>;
  private _waitingForNewLink?: Queue<SequencePackage>;
  private _finalized?: boolean;
  ongoingPackageCount = 0;

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._waitingForNewLink = undefined as any;

      if (this._onDestroyListeners) {
        let listeners = this._onDestroyListeners;
        this._onDestroyListeners = undefined as any;
        for (let listener of listeners) {
          listener();
        }
      }
    }
  }

  trigger(data: unknown): void {
    if (!this._finalized && !this.destroyed) {
      this.ongoingPackageCount++;
      this.iteratePackage(new SequencePackage(data));
    }
  }

  enterPipeline<A, B>(iterator: SequencePipelineIterator<A, B>, destructor?: SequencePipelineDestructor) {
    if (!this.destroyed) {
      if (this.attachIsCalled) {
        throw new Error('After attaching a sequence you cannot add another operation.');
      }

      if (destructor) {
        if (!this._asyncPipelineIndices) {
          this._asyncPipelineIndices = new Set();
        }
        this._asyncPipelineIndices.add(this._pipeline.length);
      }

      this._pipeline.push({ iterator, destructor });

      if (this._waitingForNewLink) {
        let waitingPackages = this._waitingForNewLink;
        this._waitingForNewLink = new Queue();
        let startedAsFinalized = this._finalized;
        while (waitingPackages.notEmpty) {
          let waitingPackage = waitingPackages.pop()!;
          this.iteratePackage(waitingPackage);
          if (startedAsFinalized !== this._finalized) {
            break;
          }
        }
      }
    }
  }

  final() {
    if (this.attachIsCalled && this.ongoingPackageCount === 0) {
      this.destroy();
    } else {
      this._finalized = true;
    }
  }

  attach(parent: IAttachable): this {
    this.onAttach();
    return super.attach(parent);
  }

  attachById(id: number): this {
    this.onAttach();
    return super.attachById(id);
  }

  attachToRoot(): this {
    this.onAttach();
    return super.attachToRoot();
  }

  private onAttach(): void {
    while (this._waitingForNewLink?.notEmpty) {
      let waitingPackage = this._waitingForNewLink.pop()!;
      waitingPackage.destroy();
      this.ongoingPackageCount--;
    }

    if (this._finalized && this.ongoingPackageCount === 0) {
      this.destroy();
    }
  }

  private iteratePackage(sequencePackage: SequencePackage): void {
    if (!this.destroyed) {
      if (sequencePackage.pipelineIndex < this._pipeline.length) {
        let context = new SequenceContext(
          this,
          () => {
            if (this._asyncPipelineIndices) {
              for (let index of this._asyncPipelineIndices) {
                if (index > sequencePackage.pipelineIndex) {
                  break;
                } else {
                  this._pipeline[index].destructor!(
                    index === sequencePackage.pipelineIndex ? sequencePackage.ongoingContext : undefined
                  );
                }
              }
            }
            this.final();
          },
          () => {
            sequencePackage.destroy();
            this.ongoingPackageCount--;
          }
        );
        sequencePackage.ongoingContext = context;

        this._pipeline[sequencePackage.pipelineIndex].iterator(sequencePackage.data, context, returnData => {
          sequencePackage.destroy();
          sequencePackage.ongoingContext = undefined;

          sequencePackage.data = returnData;
          sequencePackage.pipelineIndex++;
          this.iteratePackage(sequencePackage);
        });
      } else {
        if (!this.attachIsCalled) {
          if (!this._waitingForNewLink) {
            this._waitingForNewLink = new Queue();
          }
          this._waitingForNewLink.add(sequencePackage);
        } else {
          sequencePackage.destroy();
          this.ongoingPackageCount--;

          if (this._finalized && this.ongoingPackageCount === 0) {
            this.destroy();
          }
        }
      }
    }
  }
}

export class Sequence<T = void> implements IAttachment {
  static merge<S>(...streams: StreamType<S>[]): Sequence<S> {
    let activeSequences = this.validateAndConvertToSet(streams);

    let subscriptions: IAttachment[] = [];
    let mergedSequence = Sequence.create<S>(resolve => {
      for (let i = 0; i < streams.length; i++) {
        let subscription = streams[i].subscribe(resolve).attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      }
      return () => {
        for (let i = 0; i < streams.length; i++) {
          subscriptions[i].destroy();
        }
      };
    });

    this.waitUntilAllSequencesDestroyed(activeSequences, () => mergedSequence.executor.final());
    return mergedSequence;
  }

  static combine<const S extends readonly StreamType<any>[]>(streams: S): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, StreamType<any>>>(
    streamsObject: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, StreamType<any>> | readonly StreamType<any>[]>(input: S): Sequence<any> {
    let isArray = Comparator.isArray(input);
    let streams = Object.values(input);
    let activeStreams = this.validateAndConvertToSet(streams);

    let latestValues: any = isArray ? [] : {};
    let keys = Object.keys(input);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachment[] = [];
    let combinedSequence = Sequence.create<{ [K in keyof S]: S[K] extends Sequence<infer U> ? U : never }>(resolve => {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
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
      }

      return () => {
        for (let i = 0; i < streams.length; i++) {
          subscriptions[i].destroy();
        }
      };
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

  private static validateAndConvertToSet(streams: StreamType<unknown>[]) {
    let streamsSet = new Set(streams);
    if (streamsSet.size !== streams.length) {
      for (let i = 0; i < streams.length; i++) {
        let stream = streams[i];
        if (stream instanceof Sequence) {
          stream.executor['_attachIsCalled'] = true;
        }
      }
      throw new Error('Each given sequence to merge or combine has to be diferent.');
    }
    return streamsSet;
  }

  private static waitUntilAllSequencesDestroyed(streams: Set<StreamType<unknown>>, callback: () => void): void {
    let notifierFound = false;
    for (let stream of streams) {
      if (stream instanceof Notifier) {
        notifierFound = true;
      }
    }

    if (!notifierFound) {
      let sequences = streams as Set<Sequence<unknown>>;

      let oneDestroyed = (sequence: Sequence<unknown>) => {
        sequences.delete(sequence);
        if (sequences.size === 0) {
          callback();
        }
      };

      for (let sequence of sequences) {
        if (sequence.destroyed) {
          oneDestroyed(sequence);
        } else {
          sequence.executor.onDestroyListeners.add(() => oneDestroyed(sequence));
        }
      }
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

  read(callback: (data: T, context: ISequenceLinkContext) => void): Sequence<T> {
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

  map<K>(callback: (data: T, context: ISequenceLinkContext) => NotStream<K>): Sequence<K> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: K;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(executionReturn);
    });

    return new Sequence<K>(this.executor);
  }

  // TODO: other async map functions

  /**
   * Async mapping functions: `asyncMap`, `orderedMap`, `latestMap`, `queueMap`, `dropOngoingMap`, `dropIncomingMap`
   *
   * **Execution**: Each incoming package starts to **execute instantly** and **resolve instantly** without waiting. Which can break package order.
   *
   * **Sample Use Case**: Showing an animation for each package, regardless of what other packages are doing.
   *
   * - `✅ Never Drops Packages`
   * - `❌ Keeps Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-----------------
   * @B -----------I———>✓------------------------
   * @C ----------------I——>✓---------------------
   * @R ---------------------B-C---A-----------------
   */
  asyncMap<K>(callback: (data: T, context: ISequenceLinkContext) => StreamType<K>): Sequence<K> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: StreamType<K>;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      executionReturn.subscribe(resolve).attach(context.attachable);
    });

    return new Sequence<K>(this.executor);
  }

  /**
   * Async mapping functions: `asyncMap`, `orderedMap`, `latestMap`, `queueMap`, `dropOngoingMap`, `dropIncomingMap`
   *
   * **Execution**: Each incoming package starts to **execute instantly** but **waits before resolve** the package before them to resolve to keep the order.
   *
   * **Sample Use Case**: Using async translation service, before storing ordered event history.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Keeps Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-----------------
   * @B -----------I———I- - - - ->✓----------------
   * @C ----------------I——I- - - - >✓--------------
   * @R ----------------------------ABC--------------
   */
  orderedMap<K>(callback: (data: T, context: ISequenceLinkContext) => StreamType<K>): Sequence<K> {
    this.prepareToBeLinked();

    let queue = new Queue<ExecutionOrderQueuer>();
    this.executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        console.log(data);
        let executionReturn: StreamType<K>;

        let queuer: ExecutionOrderQueuer = { context };
        queue.add(queuer);

        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        executionReturn
          .subscribe(resolvedData => {
            queuer.callback = () => resolve(resolvedData);

            if (queue.peek() === queuer) {
              queue.pop();
              resolve(resolvedData);

              while (queue.peek()?.callback) {
                queue.pop()?.callback!();
              }
            } else {
              queuer.callback = () => resolve(resolvedData);
            }
          })
          .attach(context.attachable);
      },
      (finalContext?: SequenceContext) => {
        if (finalContext) {
          console.log('final context ', queue.notEmpty, queue.peekLast()?.context !== finalContext);
          while (queue.notEmpty && queue.peekLast()?.context !== finalContext) {
            let lastInTheLine = queue.dequeue()!;
            lastInTheLine.context.destroyAttachment();
            this.executor.ongoingPackageCount--;
          }
          if (queue.empty) {
            throw new Error(`Sequence: Internal Error, entire queue is checked but the "final item" couldn't be found!`);
          }
        } else {
          while (queue.notEmpty) {
            queue.pop()!.context.destroyAttachment();
            this.executor.ongoingPackageCount--;
          }
        }
      }
    );

    return new Sequence<K>(this.executor);
  }

  filter(callback: (data: T, previousValue: T | undefined, context: ISequenceLinkContext) => boolean): Sequence<T> {
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

  skip(count: number): Sequence<T> {
    this.prepareToBeLinked();

    let skipped = 0;
    let blocked = count > 0;

    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      if (blocked) {
        skipped++;
        if (skipped > count) {
          blocked = false;
          resolve(data);
        }
      } else {
        resolve(data);
      }
    });

    return new Sequence<T>(this.executor);
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

  attach(parent: IAttachable): this {
    this.executor.attach(parent);
    return this;
  }

  attachById(parent: number): this {
    this.executor.attachById(parent);
    return this;
  }

  attachToRoot(): this {
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
