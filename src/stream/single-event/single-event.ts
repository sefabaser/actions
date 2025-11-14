import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { ISingleEventContext, SingleEventExecutor } from './single-event-executor';

export class SingleEvent<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISingleEventContext) => (() => void) | void
  ): SingleEvent<S> {
    let singleEventExecutor = new SingleEventExecutor();

    try {
      let destroyCallback = executor(singleEventExecutor.trigger.bind(singleEventExecutor), {
        attachable: singleEventExecutor,
        destroy: () => singleEventExecutor.destroy()
      });
      if (destroyCallback) {
        singleEventExecutor.onDestroyListeners.add(destroyCallback);
      }
    } catch (e) {
      console.error(e);
    }

    return new SingleEvent<S>(singleEventExecutor);
  }

  static instant(): SingleEvent<void>;
  static instant<S>(data: S): SingleEvent<S>;
  static instant<S = void>(data?: S): SingleEvent<S> {
    let singleEventExecutor = new SingleEventExecutor();
    singleEventExecutor.resolved = true;
    singleEventExecutor.currentData = data;
    return new SingleEvent<S>(singleEventExecutor);
  }

  get destroyed(): boolean {
    return this.executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this.executor.attachIsCalled;
  }

  private linked = false;

  private constructor(private executor: SingleEventExecutor) {}

  destroy(): void {
    this.executor.destroy();
  }

  read(callback: (data: T, context: ISingleEventContext) => void): SingleEvent<T> {
    this.validateBeforeLinking();

    this.executor.enterPipeline<T, T>((data, context, resolve) => {
      try {
        callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      resolve(data);
    });

    return new SingleEvent<T>(this.executor);
  }

  map<K>(callback: (data: T, context: ISingleEventContext) => K): SingleEvent<K> {
    this.validateBeforeLinking();

    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: K;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      resolve(executionReturn);
    });

    return new SingleEvent<K>(this.executor);
  }

  /**
   * **Execution**: The incoming package **executes directly** and **directly resolves** after async operation responds.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @R ----------------------------A-------------------
   */
  asyncMap<K>(callback: (data: T, context: ISingleEventContext) => AsyncOperation<K>): SingleEvent<K> {
    this.validateBeforeLinking();

    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: AsyncOperation<K>;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      executionReturn.readSingle(resolve).attach(context.attachable);
    });

    return new SingleEvent<K>(this.executor);
  }

  // TODO: wait
  // TODO: debounce

  /*
  chain(): SingleEvent<T> {
    return;
  }*/

  /** @internal */
  readSingle(callback: (data: T) => void): SingleEvent<T> {
    this.validateBeforeLinking();

    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
        this.destroy();
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }

      resolve(data);
    });

    return new SingleEvent<T>(this.executor);
  }

  /** @internal */
  subscribe(callback: (data: T) => void): SingleEvent<T> {
    this.validateBeforeLinking();

    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Sequence callback function error: ', e);
        return;
      }
      resolve(data);
    });

    return new SingleEvent<T>(this.executor);
  }

  attach(parent: Attachable): this {
    this.executor.attach(parent);
    return this;
  }

  attachByID(id: number): this {
    this.executor.attachByID(id);
    return this;
  }

  attachToRoot(): this {
    this.executor.attachToRoot();
    return this;
  }

  chain(parent: Attachable): SingleEvent<T> {
    this.validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this.executor.chainedTo = chainExecutor;
    this.executor.attach(parent);

    return new SingleEvent(chainExecutor);
  }

  chainByID(id: number): SingleEvent<T> {
    this.validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this.executor.chainedTo = chainExecutor;
    this.executor.attachByID(id);

    return new SingleEvent(chainExecutor);
  }

  chainToRoot(): SingleEvent<T> {
    this.validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this.executor.enterPipeline<T, T>((data, _, resolve) => {
      chainExecutor.trigger(data);
      resolve(data);
    });
    this.executor.chainedTo = chainExecutor;
    this.executor.attachToRoot();

    return new SingleEvent(chainExecutor);
  }

  private validateBeforeLinking(): void {
    if (this.linked) {
      throw new Error('Single Event: A single event can only be linked once.');
    }
    if (this.executor.attachIsCalled) {
      throw new Error('Single Event: After attaching, you cannot add another operation.');
    }
    this.linked = true;
  }
}

/** @internal */
export const SingleEventClassNames = [SingleEvent.name, SingleEventExecutor.name, 'SingleEventContext'];
