import { Queue } from 'helpers-lib';

import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { SingleEvent } from '../single-event/single-event';
import { SingleEventExecutor } from '../single-event/single-event-executor';
import { ISequenceCreatorContext, ISequenceLinkContext, SequenceExecutor } from './sequence-executor';

type ExecutionOrderQueuer = {
  _callback?: () => void;
  _context: ISequenceLinkContext;
};

export class Sequence<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISequenceCreatorContext) => (() => void) | void
  ): Sequence<S> {
    let sequenceExecutor = new SequenceExecutor();

    try {
      let destroyCallback = executor(sequenceExecutor._trigger.bind(sequenceExecutor), {
        attachable: sequenceExecutor,
        final: sequenceExecutor._final.bind(sequenceExecutor),
        destroy: sequenceExecutor.destroy.bind(sequenceExecutor)
      });
      if (destroyCallback) {
        sequenceExecutor._onDestroyListeners.add(destroyCallback);
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

    sequenceExecutor._pendingValues = data;
    sequenceExecutor._ongoingPackageCount = data.length;
    return new Sequence<S>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this._executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this._executor.attachIsCalled;
  }

  /** @internal */
  _executor: SequenceExecutor;
  private _linked?: boolean;

  private constructor(executor: SequenceExecutor) {
    this._executor = executor;
  }

  destroy(): void {
    this._executor.destroy();
  }

  tap(callback: (data: T, context: ISequenceLinkContext) => void): Sequence<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, context, resolve) => {
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

    this._executor._enterPipeline<T, K>((data, context, resolve) => {
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

  filter(callback: (data: T, previousValue: T | undefined, context: ISequenceLinkContext) => boolean): Sequence<T> {
    this._validateBeforeLinking();

    let previousValue: T | undefined;
    this._executor._enterPipeline<T, T>((data, context, resolve) => {
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

    this._executor._enterPipeline<T, T>((data, context, resolve) => {
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

  skip(count: number): Sequence<T> {
    this._validateBeforeLinking();

    let skipped = 0;
    let blocked = count > 0;

    this._executor._enterPipeline<T, T>((data, _, resolve) => {
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

  wait(duration?: number): Sequence<T> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    this._executor._enterPipeline<T, T>(
      (data, context, resolve) => {
        let queuer: ExecutionOrderQueuer = { _context: context };
        queue.add(queuer);

        SingleEvent.create(innerResolve => {
          let timeout = setTimeout(innerResolve, duration);
          return () => clearTimeout(timeout);
        })
          .tap(() => {
            let item = queue.pop();
            if (item !== queuer) {
              throw new Error('Sequence: Internal Error. Wait queue is curropted.');
            }
            resolve(data);
          })
          .attach(context.attachable);
      },
      (finalContext?: ISequenceLinkContext) => this._destroyPackagesUntilCurrent(queue, finalContext)
    );

    return new Sequence<T>(this._executor);
  }

  /**
   * Drops the previous package that is still waiting for the timeout.
   */
  debounce(duration?: number): Sequence<T> {
    this._validateBeforeLinking();

    let ongoingContext: ISequenceLinkContext | undefined;
    this._executor._enterPipeline<T, T>(
      (data, context, resolve) => {
        ongoingContext?.drop();
        ongoingContext = context;

        SingleEvent.create(innerResolve => {
          let timeout = setTimeout(innerResolve, duration);
          return () => {
            clearTimeout(timeout);
          };
        })
          .tap(() => resolve(data))
          .attach(context.attachable);
      },
      (finalContext?: ISequenceLinkContext) => {
        if (!finalContext) {
          ongoingContext?.drop();
          ongoingContext = undefined;
        }
      }
    );

    return new Sequence<T>(this._executor);
  }

  // TODO: asyncTap

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
  asyncMapDirect<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContexts = new Set<ISequenceLinkContext>();

    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: any;

        ongoingContexts.add(context);
        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        if (executionReturn?._subscribeSingle) {
          (executionReturn as AsyncOperation<K>)
            ._subscribeSingle(resolvedData => {
              ongoingContexts.delete(context);
              resolve(resolvedData);
            })
            .attach(context.attachable);
        } else {
          ongoingContexts.delete(context);
          resolve(executionReturn as K);
        }
      },
      (finalContext?: ISequenceLinkContext) => {
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
  asyncMapOrdered<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: any;

        let queuer: ExecutionOrderQueuer = { _context: context };
        queue.add(queuer);

        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        let afterResolve = (resolvedData: K) => {
          queuer._callback = () => resolve(resolvedData);

          if (queue.peek() === queuer) {
            queue.pop();
            resolve(resolvedData);

            while (queue.peek()?._callback) {
              queue.pop()?._callback!();
            }
          } else {
            queuer._callback = () => resolve(resolvedData);
          }
        };

        if (executionReturn?._subscribeSingle) {
          (executionReturn as AsyncOperation<K>)._subscribeSingle(afterResolve).attach(context.attachable);
        } else {
          afterResolve(executionReturn as K);
        }
      },
      (finalContext?: ISequenceLinkContext) => this._destroyPackagesUntilCurrent(queue, finalContext)
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
  asyncMapLatest<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: any;

        let queuer: ExecutionOrderQueuer = { _context: context };
        queue.add(queuer);

        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        let afterResolve = (resolvedData: K) => {
          while (queue.notEmpty) {
            let firstInTheLine = queue.pop();

            if (firstInTheLine && firstInTheLine._context !== context) {
              firstInTheLine._context.drop();
            } else {
              break;
            }
          }

          resolve(resolvedData);
        };

        if (executionReturn?._subscribeSingle) {
          (executionReturn as AsyncOperation<K>)._subscribeSingle(afterResolve).attach(context.attachable);
        } else {
          afterResolve(executionReturn as K);
        }
      },
      (finalContext?: ISequenceLinkContext) => this._destroyPackagesUntilCurrent(queue, finalContext)
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
    callback: (data: T, previousResult: K | undefined, context: ISequenceLinkContext) => AsyncOperation<K> | K
  ): Sequence<K> {
    this._validateBeforeLinking();

    let queue = new Queue<ExecutionOrderQueuer>();
    let previousResult: K | undefined;

    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let execute = () => {
          let executionReturn: any;
          try {
            executionReturn = callback(data, previousResult, context);
          } catch (e) {
            console.error('Sequence callback function error: ', e);
            return;
          }

          let afterResolve = (resolvedData: K) => {
            queue.pop();
            previousResult = resolvedData;
            resolve(resolvedData);
            queue.peek()?._callback!();
          };

          if (executionReturn?._subscribeSingle) {
            (executionReturn as AsyncOperation<K>)._subscribeSingle(afterResolve).attach(context.attachable);
          } else {
            afterResolve(executionReturn as K);
          }
        };

        let queueWasEmpty = queue.empty;
        let queuer: ExecutionOrderQueuer = { _context: context, _callback: execute };
        queue.add(queuer);

        if (queueWasEmpty) {
          execute();
        }
      },
      (finalContext?: ISequenceLinkContext) => this._destroyPackagesUntilCurrent(queue, finalContext)
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
  asyncMapDropOngoing<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContext: ISequenceLinkContext | undefined;
    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: any;

        ongoingContext?.drop();
        ongoingContext = context;
        try {
          executionReturn = callback(data, context);
        } catch (e) {
          console.error('Sequence callback function error: ', e);
          return;
        }

        let afterResolve = (resolvedData: K) => {
          ongoingContext = undefined;
          resolve(resolvedData);
        };

        if (executionReturn?._subscribeSingle) {
          (executionReturn as AsyncOperation<K>)._subscribeSingle(afterResolve).attach(context.attachable);
        } else {
          afterResolve(executionReturn as K);
        }
      },
      (finalContext?: ISequenceLinkContext) => {
        if (!finalContext) {
          ongoingContext?.drop();
          ongoingContext = undefined;
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
  asyncMapDropIncoming<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    this._validateBeforeLinking();

    let ongoingContext: ISequenceLinkContext | undefined;
    this._executor._enterPipeline<T, K>(
      (data, context, resolve) => {
        let executionReturn: any;

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

          let afterResolve = (resolvedData: K) => {
            ongoingContext = undefined;
            resolve(resolvedData);
          };

          if (executionReturn?._subscribeSingle) {
            (executionReturn as AsyncOperation<K>)._subscribeSingle(afterResolve).attach(context.attachable);
          } else {
            afterResolve(executionReturn as K);
          }
        }
      },
      (finalContext?: ISequenceLinkContext) => {
        if (!finalContext) {
          ongoingContext?.drop();
          ongoingContext = undefined;
        }
      }
    );

    return new Sequence<K>(this._executor);
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): Sequence<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, _, resolve) => {
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

    this._executor._enterPipeline<T, T>((data, _, resolve) => {
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

  /**
   * Acts like .take(1) but returns a SingleEvent instead.
   * Destroys the sequence after single package goes out of the pipeline.
   * @returns SingleEvent
   */
  toSingleEvent(): SingleEvent<T> {
    this._validateBeforeLinking();

    let singleEventExecutor = new SingleEventExecutor();
    singleEventExecutor._chainedFrom = this._executor;
    singleEventExecutor._attachChainedFromAsWell = true;
    this._executor._chainedTo = singleEventExecutor;
    this._executor._destroyAfterFirstPackage = true;

    return SingleEvent._createManual<T>(singleEventExecutor);
  }

  /**
   * Attaches the sequence and returns a new sequence that continues from this sequence.
   * Handy for function that returns a Sequence that might not be used. Sequence up to chain operates regardless.
   * @returns Sequence
   */
  chain(parent: Attachable): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attach(parent);

    return new Sequence(chainExecutor);
  }

  /**
   * Attaches the sequence and returns a new sequence that continues from this sequence.
   * Handy for function that returns a Sequence that might not be used. Sequence up to chain operates regardless.
   * @returns Sequence
   */
  chainByID(id: number): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachByID(id);

    return new Sequence(chainExecutor);
  }

  /**
   * Attaches the sequence and returns a new sequence that continues from this sequence.
   * Handy for function that returns a Sequence that might not be used. Sequence up to chain operates regardless.
   * @returns Sequence
   */
  chainToRoot(): Sequence<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SequenceExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachToRoot();

    return new Sequence(chainExecutor);
  }

  /**
   * Acts like .toSingleEvent().chain(parent) but in single run for more optimization
   * Destroys the sequence after single package goes out of the pipeline.
   * Handy for function that returns a SingleEvent that might not be used. Sequence up to chain operates regardless.
   * @returns SingleEvent
   */
  singleChain(parent: Attachable): SingleEvent<T> {
    this._validateBeforeLinking();

    let singleEventExecutor = new SingleEventExecutor();
    singleEventExecutor._chainedFrom = this._executor;
    this._executor._chainedTo = singleEventExecutor;
    this._executor._destroyAfterFirstPackage = true;
    this._executor.attach(parent);

    return SingleEvent._createManual(singleEventExecutor);
  }

  /**
   * Acts like .toSingleEvent().chainByID(id) but in single run for more optimization
   * Destroys the sequence after single package goes out of the pipeline.
   * Handy for function that returns a SingleEvent that might not be used. Sequence up to chain operates regardless.
   * @returns SingleEvent
   */
  singleChainByID(id: number): SingleEvent<T> {
    this._validateBeforeLinking();

    let singleEventExecutor = new SingleEventExecutor();
    singleEventExecutor._chainedFrom = this._executor;
    this._executor._chainedTo = singleEventExecutor;
    this._executor._destroyAfterFirstPackage = true;
    this._executor.attachByID(id);

    return SingleEvent._createManual(singleEventExecutor);
  }

  /**
   * Acts like .toSingleEvent().chainToRoot() but in single run for more optimization
   * Destroys the sequence after single package goes out of the pipeline.
   * Handy for function that returns a SingleEvent that might not be used. Sequence up to chain operates regardless.
   * @returns SingleEvent
   */
  singleChainToRoot(): SingleEvent<T> {
    this._validateBeforeLinking();

    let singleEventExecutor = new SingleEventExecutor();
    singleEventExecutor._chainedFrom = this._executor;
    this._executor._chainedTo = singleEventExecutor;
    this._executor._destroyAfterFirstPackage = true;
    this._executor.attachToRoot();

    return SingleEvent._createManual(singleEventExecutor);
  }

  private _destroyPackagesUntilCurrent(queue: Queue<ExecutionOrderQueuer>, finalContext?: ISequenceLinkContext): void {
    if (finalContext) {
      while (queue.notEmpty && queue.peekLast()?._context !== finalContext) {
        let lastInTheLine = queue.dequeue()!;
        lastInTheLine._context.drop();
      }
      if (queue.empty) {
        throw new Error(`Sequence: Internal Error, entire queue is checked but the "final item" couldn't be found!`);
      }
    } else {
      while (queue.notEmpty) {
        queue.pop()!._context.drop();
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
