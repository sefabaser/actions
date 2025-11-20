import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { ISingleEventContext, SingleEventExecutor } from './single-event-executor';

export class SingleEvent<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISingleEventContext) => (() => void) | void
  ): SingleEvent<S> {
    let singleEventExecutor = new SingleEventExecutor();

    try {
      let destroyCallback = executor(singleEventExecutor._trigger.bind(singleEventExecutor), {
        attachable: singleEventExecutor,
        destroy: () => singleEventExecutor.destroy()
      });
      if (destroyCallback) {
        singleEventExecutor._onDestroyListeners.add(destroyCallback);
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
    singleEventExecutor._resolved = true;
    singleEventExecutor._currentData = data;
    return new SingleEvent<S>(singleEventExecutor);
  }

  /** @internal */
  static _createManual<S = void>(executor: SingleEventExecutor) {
    return new SingleEvent<S>(executor);
  }

  get destroyed(): boolean {
    return this._executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this._executor.attachIsCalled;
  }

  private _linked?: boolean;

  private constructor(private _executor: SingleEventExecutor) {}

  destroy(): void {
    this._executor.destroy();
  }

  read(callback: (data: T, context: ISingleEventContext) => void): SingleEvent<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, context, resolve) => {
      try {
        callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      resolve(data);
    });

    return new SingleEvent<T>(this._executor);
  }

  map<K>(callback: (data: T, context: ISingleEventContext) => K): SingleEvent<K> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: K;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      resolve(executionReturn);
    });

    return new SingleEvent<K>(this._executor);
  }

  wait(duration?: number): SingleEvent<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, context, resolve) => {
      SingleEvent.create(innerResolve => {
        let timeout = setTimeout(innerResolve, duration);
        return () => {
          clearTimeout(timeout);
        };
      })
        .read(() => resolve(data))
        .attach(context.attachable);
    });

    return new SingleEvent<T>(this._executor);
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
  asyncMap<K>(callback: (data: T, context: ISingleEventContext) => AsyncOperation<K> | K): SingleEvent<K> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: any;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      if (executionReturn?._subscribeSingle) {
        (executionReturn as AsyncOperation<K>)._subscribeSingle(resolve).attach(context.attachable);
      } else {
        resolve(executionReturn as K);
      }
    });

    return new SingleEvent<K>(this._executor);
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): SingleEvent<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
        this.destroy();
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      resolve(data);
    });

    return new SingleEvent<T>(this._executor);
  }

  /** @internal */
  subscribe(callback: (data: T) => void): SingleEvent<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, _, resolve) => {
      try {
        callback(data);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }
      resolve(data);
    });

    return new SingleEvent<T>(this._executor);
  }

  attach(parent: Attachable): this {
    this._executor.attach(parent);
    return this;
  }

  attachByID(id: number): this {
    this._executor.attachByID(id);
    return this;
  }

  attachToRoot(): this {
    this._executor.attachToRoot();
    return this;
  }

  chain(parent: Attachable): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attach(parent);

    return new SingleEvent(chainExecutor);
  }

  chainByID(id: number): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachByID(id);

    return new SingleEvent(chainExecutor);
  }

  chainToRoot(): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachToRoot();

    return new SingleEvent(chainExecutor);
  }

  private _validateBeforeLinking(): void {
    if (this._linked) {
      throw new Error('Single Event: A single event can only be linked once.');
    }
    if (this._executor.attachIsCalled) {
      throw new Error('Single Event: After attaching, you cannot add another operation.');
    }
    this._linked = true;
  }
}

/** @internal */
export const SingleEventClassNames = [SingleEvent.name, SingleEventExecutor.name, 'SingleEventContext'];
