import { Comparator, Queue } from 'helpers-lib';

import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { Notifier } from '../../observables/_notifier/notifier';
import { ISequenceCreatorContext, ISequenceLinkContext, SequenceContext, SequenceExecutor } from './sequence-executor';

type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

type ExecutionOrderQueuer = {
  callback?: () => void;
  context: ISequenceLinkContext;
};

export class Sequence<T = void> implements IAttachment {
  static merge<S>(...streams: AsyncOperation<S>[]): Sequence<S> {
    let activeSequences = this._validateAndConvertToSet(streams);

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

    this._waitUntilAllSequencesDestroyed(activeSequences, () => mergedSequence._executor.final());
    return mergedSequence;
  }

  static combine<const S extends readonly AsyncOperation<any>[]>(
    streams: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>>>(
    streamsObject: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(input: S): Sequence<any> {
    let isArray = Comparator.isArray(input);
    let streams = Object.values(input);
    let activeStreams = this._validateAndConvertToSet(streams);

    let latestValues: any = isArray ? [] : {};
    let keys = Object.keys(input);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachment[] = [];
    let combinedSequence = Sequence.create<{ [K in keyof S]: S[K] extends Sequence<infer U> ? U : never }>(resolve => {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let stream = (input as any)[key];
        let subscription = stream
          .subscribe((data: unknown) => {
            latestValues[key] = data;
            if (unresolvedKeys.size === 0) {
              resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
            } else {
              unresolvedKeys.delete(key);
              if (unresolvedKeys.size === 0) {
                resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
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

    this._waitUntilAllSequencesDestroyed(activeStreams, () => combinedSequence._executor.final());
    return combinedSequence;
  }

  private static _shallowCopy<S extends object>(obj: S): S {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = (obj as any)[key];
      return acc;
    }, {} as any);
  }

  private static _validateAndConvertToSet(streams: AsyncOperation<unknown>[]) {
    let streamsSet = new Set(streams);
    if (streamsSet.size !== streams.length) {
      for (let i = 0; i < streams.length; i++) {
        let stream = streams[i];
        if (stream instanceof Sequence) {
          stream._executor._attachIsCalled = true;
        }
      }

      throw new Error('Each given sequence to merge or combine has to be diferent.');
    }
    return streamsSet;
  }

  private static _waitUntilAllSequencesDestroyed(streams: Set<AsyncOperation<unknown>>, callback: () => void): void {
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
          sequence._executor.onDestroyListeners.add(() => oneDestroyed(sequence));
        }
      }
    }
  }

  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISequenceCreatorContext) => (() => void) | void
  ): Sequence<S> {
    let sequenceExecutor = new SequenceExecutor();

    try {
      let destroyCallback = executor(sequenceExecutor.trigger.bind(sequenceExecutor), {
        attachable: sequenceExecutor,
        final: sequenceExecutor.final.bind(sequenceExecutor),
        destroy: sequenceExecutor.destroy.bind(sequenceExecutor)
      });
      if (destroyCallback) {
        sequenceExecutor.onDestroyListeners.add(destroyCallback);
      }
    } catch (e) {
      console.error(e);
    }

    return new Sequence<S>(sequenceExecutor);
  }

  static instant(): Sequence<void>;
  static instant<S>(...data: S[]): Sequence<S>;
  static instant<S = void>(...data: S[]): Sequence<S> {
    let sequenceExecutor = new SequenceExecutor();

    if (data.length === 0) {
      data = [undefined as S];
    }

    sequenceExecutor.pendingValues = data;
    sequenceExecutor.ongoingPackageCount = data.length;
    return new Sequence<S>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this._executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this._executor.attachIsCalled;
  }

  private _linked = false;
  private constructor(private _executor: SequenceExecutor) {}

  destroy(): void {
    this._executor.destroy();
  }

  read(callback: (data: T, context: ISequenceLinkContext) => void): Sequence<T> {
    this._validateBeforeLinking();

    this._executor.enterPipeline<T, T>((data, context, resolve) => {
      try {
        callback(data, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });
    return new Sequence<T>(this._executor);
  }

  map<K>(callback: (data: T, context: ISequenceLinkContext) => K): Sequence<K> {
    this._validateBeforeLinking();

    this._executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: K;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(executionReturn);
    });

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting. Which can break package order.
   *
   * **Sample Use Case**: Showing an animation for each package, regardless of what other packages are doing.
   *
   * - `✅ Never Drops Packages`
   * - `❌ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I———>✓----------------------------
   * @C --------------I——>✓-------------------------
   * @R -------------------B-C-----A-------------------
   */
  asyncMapDirect<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContexts = new Set<ISequenceLinkContext>();

    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: AsyncOperation<K>;

        ongoingContexts.add(context);
        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        executionReturn
          .readSingle(resolvedData => {
            ongoingContexts.delete(context);
            resolve(resolvedData);
          })
          .attach(context.attachable);
      },
      (finalContext?: SequenceContext) => {
        if (!finalContext) {
          for (let context of ongoingContexts) {
            context.drop();
          }
        }
      }
    );

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes directly** but **waits before resolve** the package before them to resolve to keep the order.
   *
   * **Sample Use Case**: Using async translation service, before storing ordered event history.
   *
   * **⚠️Careful**: Can create a bottleneck! If an async operation never resolves, all packages behind will be stuck.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I———I- - - - - - >✓-----------------
   * @C --------------I——I- - - - - >✓----------------
   * @R ----------------------------ABC----------------
   */
  asyncMapOrdered<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: AsyncOperation<K>;

        let queuer: ExecutionOrderQueuer = { context };
        queue.add(queuer);

        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        executionReturn
          .readSingle(resolvedData => {
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
        this._destroyPackagesUntilCurrent(queue, finalContext);
      }
    );

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * The latest value is important, the packages that lacks behind are dropped.
   *
   * **Sample Use Case**: Converting a state with translating some keys in it with an async “translate” function.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I——————Ix----------------------------
   * @B ---------I———>✓----------------------------
   * @C --------------I——>✓-------------------------
   * @R -------------------B-C-------------------------
   */
  asyncMapLatest<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: AsyncOperation<K>;

        let queuer: ExecutionOrderQueuer = { context };
        queue.add(queuer);

        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        executionReturn
          .readSingle(resolvedData => {
            while (queue.notEmpty) {
              let firstInTheLine = queue.pop();

              if (firstInTheLine && firstInTheLine.context !== context) {
                firstInTheLine.context.drop();
              } else {
                break;
              }
            }

            resolve(resolvedData);
          })
          .attach(context.attachable);
      },
      (finalContext?: SequenceContext) => {
        this._destroyPackagesUntilCurrent(queue, finalContext);
      }
    );

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes sequentially** and **resolves directly** without waiting.
   *
   * **Sample Use Case**: Payment operation, one can be processed if the previous one ends in success.
   *
   * **⚠️Careful**: Can create a bottleneck! The feeding speed should not exceed the digestion speed.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I- - - - - - - - - - - I———>✓---------
   * @C --------------I- - - - - - - - - - - - - - I——>✓-
   * @R ----------------------------A--------B------C--
   */
  asyncMapQueue<K>(
    callback: (data: T, previousResult: K | undefined, context: ISequenceLinkContext) => AsyncOperation<K>
  ): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    let previousResult: K | undefined;

    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let execute = () => {
          let executionReturn: AsyncOperation<K>;
          try {
            executionReturn = callback(data, previousResult, context);
          } catch (e) {
            console.error('Sequence callback function error: ', e);
            return;
          }

          executionReturn
            .readSingle(resolvedData => {
              queue.pop();
              previousResult = resolvedData;
              resolve(resolvedData);
              queue.peek()?.callback!();
            })
            .attach(context.attachable);
        };

        let queueWasEmpty = queue.empty;
        let queuer: ExecutionOrderQueuer = { context, callback: execute };
        queue.add(queuer);

        if (queueWasEmpty) {
          execute();
        }
      },
      (finalContext?: SequenceContext) => {
        this._destroyPackagesUntilCurrent(queue, finalContext);
      }
    );

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * If a new package comes while another is in progress, the one in progress will be dropped.
   *
   * **Sample Use Case**: Auto completion with async operation. If value changes the old operation becomes invalid.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I——Ix--------------------------------------
   * @B ---------I——Ix--------------------------------
   * @C ---------------I——>✓------------------------
   * @R ----------------------C-------------------------
   */
  asyncMapDropOngoing<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContext: ISequenceLinkContext | undefined;
    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: AsyncOperation<K>;

        ongoingContext?.drop();
        ongoingContext = context;
        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        executionReturn
          .readSingle(resolvedData => {
            ongoingContext = undefined;
            resolve(resolvedData);
          })
          .attach(context.attachable);
      },
      (finalContext?: SequenceContext) => {
        if (!finalContext) {
          ongoingContext?.drop();
        }
      }
    );

    return new Sequence<K>(this._executor);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * If a package is in progress, the newcomers will be dropped.
   *
   * **Sample Use Case**: Refresh button. While in progress, the new requests gets ignored.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------x--------------------------------------
   * @C ---------------x--------------------------------
   * @R ---------------------------A--------------------
   */
  asyncMapDropIncoming<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K>): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContext: ISequenceLinkContext | undefined;
    this._executor.enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: AsyncOperation<K>;

        if (ongoingContext) {
          context.drop();
        } else {
          ongoingContext = context;
          try {
            executionReturn = callback(data, context);
          } catch (e) {
            console.error('Sequence callback function error: ', e);
            return;
          }

          executionReturn
            .readSingle(resolvedData => {
              ongoingContext = undefined;
              resolve(resolvedData);
            })
            .attach(context.attachable);
        }
      },
      (finalContext?: SequenceContext) => {
        if (!finalContext) {
          ongoingContext?.drop();
        }
      }
    );

    return new Sequence<K>(this._executor);
  }

  filter(callback: (data: T, previousValue: T | undefined, context: ISequenceLinkContext) => boolean): Sequence<T> {
    this._validateBeforeLinking();

    let previousValue: T | undefined;
    this._executor.enterPipeline<T, T>((data, context, resolve) => {
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
    return new Sequence<T>(this._executor);
  }

  take(count: number): Sequence<T> {
    this._validateBeforeLinking();

    let taken = 0;

    this._executor.enterPipeline<T, T>((data, context, resolve) => {
      taken++;

      if (taken >= count) {
        context.final();
      }

      if (taken <= count) {
        resolve(data);
      }
    });

    return new Sequence<T>(this._executor);
  }

  /*
  takeOne(): SingleEvent<T> {
    this.validateBeforeLinking();

    let singleEvent = SingleEvent.create<T>(singleEventResolve => {
      this.executor.enterPipeline<T, T>((data, context, resolve) => {
        singleEventResolve(data);
        context.destroy();
      });
    });

    this.executor.chainedTo = singleEvent;
    singleEvent.

    return singleEvent;
  }*/

  skip(count: number): Sequence<T> {
    this._validateBeforeLinking();

    let skipped = 0;
    let blocked = count > 0;

    this._executor.enterPipeline<T, T>((data, _, resolve) => {
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

    return new Sequence<T>(this._executor);
  }

  /** @internal */
  readSingle(callback: (data: T) => void): Sequence<T> {
    this._validateBeforeLinking();

    this._executor.enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
        this.destroy();
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });

    return new Sequence<T>(this._executor);
  }

  /** @internal */
  subscribe(callback: (data: T) => void): Sequence<T> {
    this._validateBeforeLinking();

    this._executor.enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }
      resolve(data);
    });

    return new Sequence<T>(this._executor);
  }

  attach(parent: Attachable): this {
    this._executor.attach(parent);
    return this;
  }

  attachByID(parent: number): this {
    this._executor.attachByID(parent);
    return this;
  }

  attachToRoot(): this {
    this._executor.attachToRoot();
    return this;
  }

  chain(parent: Attachable): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this._executor.chainedTo = chainExecutor;
    this._executor.attach(parent);

    return new Sequence(chainExecutor);
  }

  chainByID(id: number): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this._executor.chainedTo = chainExecutor;
    this._executor.attachByID(id);

    return new Sequence(chainExecutor);
  }

  chainToRoot(): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this._executor.chainedTo = chainExecutor;
    this._executor.attachToRoot();

    return new Sequence(chainExecutor);
  }

  private _destroyPackagesUntilCurrent(queue: Queue<ExecutionOrderQueuer>, finalContext?: SequenceContext): void {
    if (finalContext) {
      while (queue.notEmpty && queue.peekLast()?.context !== finalContext) {
        let lastInTheLine = queue.dequeue()!;
        lastInTheLine.context.drop();
      }
      if (queue.empty) {
        throw new Error(`Sequence: Internal Error, entire queue is checked but the "final item" couldn't be found!`);
      }
    } else {
      while (queue.notEmpty) {
        queue.pop()!.context.drop();
      }
    }
  }

  private _validateBeforeLinking(): void {
    if (this._linked) {
      throw new Error('A sequence can only be linked once.');
    }
    if (this._executor.attachIsCalled) {
      throw new Error('Sequence: After attaching, you cannot add another operation.');
    }
    this._linked = true;
  }
}

/** @internal */
export const SequencePackageClassName = 'SequencePackage';
/** @internal */
export const SequenceClassNames = [
  Sequence.name,
  SequenceExecutor.name,
  SequencePackageClassName,
  SequenceContext.name,
  Queue.name,
  'DoublyLinkedListNode'
];
