import { Attachable, IAttachment } from '../attachable/attachable';
import { AsyncOperation, SyncOperation } from '../common';

type SingleEventPipelineIterator<A = unknown, B = unknown> = (
  data: A,
  context: SingleEventContext,
  callback: (returnData: B) => void
) => void;

export interface ISingleEventContext {
  readonly attachable: Attachable;
  destroy(): void;
}

class SingleEventContext implements ISingleEventContext {
  private _attachable?: Attachable;
  get attachable(): Attachable {
    if (!this._attachable) {
      this._attachable = new Attachable().attach(this.executor);
    }
    return this._attachable;
  }

  constructor(private executor: SingleEventExecuter) {}

  destroy(): void {
    this.executor.destroy();
  }

  /** @internal */
  drop() {
    this._attachable?.destroy();
  }
}

class SingleEventExecuter extends Attachable {
  private _onDestroyListeners?: Set<() => void>;
  get onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListeners) {
      this._onDestroyListeners = new Set();
    }
    return this._onDestroyListeners;
  }

  resolved = false;
  currentData: unknown;

  private _pipeline: SingleEventPipelineIterator[] = [];
  private pipelineIndex = 0;
  private ongoingContext?: SingleEventContext;

  constructor() {
    super(true);
  }

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this.currentData = undefined;
      this.ongoingContext?.drop();

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
    if (this.resolved) {
      throw new Error('Single Event: It can only resolve once.');
    }

    if (!this.destroyed) {
      this.resolved = true;
      this.currentData = data;

      if (this.attachIsCalled) {
        this.iteratePackage(this.currentData);
      }
    }
  }

  enterPipeline<A, B>(iterator: SingleEventPipelineIterator<A, B>) {
    if (!this.destroyed) {
      this.destroyIfNotAttached = false;
      this._pipeline.push(iterator);
    }
  }

  attach(parent: Attachable): this {
    if (this.resolved) {
      this.iteratePackage(this.currentData);
    }
    return super.attach(parent);
  }

  attachByID(id: number): this {
    if (this.resolved) {
      this.iteratePackage(this.currentData);
    }
    return super.attachByID(id);
  }

  attachToRoot(): this {
    if (this.resolved) {
      this.iteratePackage(this.currentData);
    }
    return super.attachToRoot();
  }

  private iteratePackage(data: unknown): void {
    if (!this.destroyed) {
      if (this.pipelineIndex < this._pipeline.length) {
        this.ongoingContext = new SingleEventContext(this);

        this._pipeline[this.pipelineIndex](data, this.ongoingContext, this.resolve);
      } else {
        this.destroy();
      }
    }
  }

  private resolve = (returnData: unknown) => {
    this.ongoingContext?.drop();
    this.ongoingContext = undefined;

    this.pipelineIndex++;
    this.iteratePackage(returnData);
  };
}

export class SingleEvent<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISingleEventContext) => (() => void) | void
  ): SingleEvent<S> {
    let singleEventExecutor = new SingleEventExecuter();

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
    let singleEventExecutor = new SingleEventExecuter();
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
  private chained = false;

  private constructor(private executor: SingleEventExecuter) {}

  destroy(): void {
    this.executor.destroy();
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

  map<K>(callback: (data: T, context: ISingleEventContext) => SyncOperation<K>): SingleEvent<K> {
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
export const SingleEventClassNames = [SingleEvent.name, SingleEventExecuter.name];
