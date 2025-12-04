import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { ISingleEventContext, SingleEventExecutor } from './single-event-executor';

export class SingleEvent<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISingleEventContext) => (() => void) | void
  ): SingleEvent<S> {
    let singleEventExecutor = new SingleEventExecutor();

    try {
      let destroyCallback = executor(
        singleEventExecutor._trigger.bind(singleEventExecutor),
        singleEventExecutor._getCreatorContext()
      );
      if (destroyCallback) {
        if (singleEventExecutor._finalized) {
          destroyCallback();
        } else {
          singleEventExecutor._onFinalListener = destroyCallback;
        }
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

  /** @internal */
  _executor: SingleEventExecutor;

  private constructor(executor: SingleEventExecutor) {
    this._executor = executor;
  }

  destroy(): void {
    this._executor.destroy();
  }

  tap(callback: (data: T, context: ISingleEventContext) => void): SingleEvent<T> {
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

  mapToVoid(): SingleEvent<void> {
    this._validateBeforeLinking();
    this._executor._enterPipeline<T, void>((_, __, resolve) => resolve());
    return new SingleEvent(this._executor);
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
        .tap(() => resolve(data))
        .attach(context.attachable);
    });

    return new SingleEvent<T>(this._executor);
  }

  /**
   * If an async operation is being returned, it waits until it resolves before continuing the execution.
   * It allows reading the value but returned value does not change the value of the execution.
   */
  asyncTap(callback: (data: T, context: ISingleEventContext) => unknown): SingleEvent<T> {
    this._validateBeforeLinking();

    this._executor._enterPipeline<T, T>((data, context, resolve) => {
      let executionReturn: any;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      if (executionReturn?._subscribeSingle) {
        (executionReturn as AsyncOperation<T>)._subscribeSingle(() => resolve(data)).attach(context.attachable);
      } else {
        resolve(data);
      }
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

  /**
   * Attaches the single event and returns a new single event that continues from this.
   * Handy for function that returns a SingleEvent that might not be used. SingleEvent up to chain operates regardless.
   * Set "destroyIfNotAttached()" by default.
   * @returns SingleEvent
   */
  chain(parent: Attachable): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    chainExecutor.destroyIfNotAttached();
    this._executor._chainedTo = chainExecutor;
    this._executor.attach(parent);

    return new SingleEvent(chainExecutor);
  }

  /**
   * Attaches the single event and returns a new single event that continues from this.
   * Handy for function that returns a SingleEvent that might not be used. SingleEvent up to chain operates regardless.
   * Set "destroyIfNotAttached()" by default.
   * @returns SingleEvent
   */
  chainByID(id: number): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    chainExecutor.destroyIfNotAttached();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachByID(id);

    return new SingleEvent(chainExecutor);
  }

  /**
   * Attaches the single event and returns a new single event that continues from this.
   * Handy for function that returns a SingleEvent that might not be used. SingleEvent up to chain operates regardless.
   * Set "destroyIfNotAttached()" by default.
   * @returns SingleEvent
   */
  chainToRoot(): SingleEvent<T> {
    this._validateBeforeLinking();

    let chainExecutor = new SingleEventExecutor();
    chainExecutor.destroyIfNotAttached();
    this._executor._chainedTo = chainExecutor;
    this._executor.attachToRoot();

    return new SingleEvent(chainExecutor);
  }

  destroyIfNotAttached(): this {
    this._executor.destroyIfNotAttached();
    return this;
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
