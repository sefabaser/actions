import { Attachable, IAttachable, IAttachment } from '../attachable/attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type NotStream<T> = T extends SingleEvent<any> ? (T extends Notifier<any> ? never : never) : T;
export type StreamType<T = void> = Notifier<T> | SingleEvent<T>;

type SingleEventPipelineIterator<A = unknown, B = unknown> = (
  data: A,
  context: SingleEventContext,
  callback: (returnData: B) => void
) => void;

export interface ISingleEventContext {
  attachable: IAttachable;
  // TODO: destroy sequence function
}

class SingleEventContext implements ISingleEventContext {
  private _attachable?: IAttachable;
  get attachable(): IAttachable {
    if (!this._attachable) {
      this._attachable = new Attachable().attach(this.executor);
    }
    return this._attachable;
  }

  constructor(private executor: SingleEventExecuter) {}

  /** @internal */
  destroyAttachment() {
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

  private _pipeline: SingleEventPipelineIterator[] = [];
  private currentData: unknown;
  private pipelineIndex = 0;
  private pending = false;
  private ongoingContext?: SingleEventContext;

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this.ongoingContext?.destroyAttachment();

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
    if (!this.destroyed) {
      this.currentData = data;
      this.iteratePackage();
    }
  }

  enterPipeline<A, B>(iterator: SingleEventPipelineIterator<A, B>) {
    if (!this.destroyed) {
      if (this.attachIsCalled) {
        throw new Error('After attaching a sequence you cannot add another operation.');
      }

      this._pipeline.push(iterator);

      if (this.pending) {
        this.iteratePackage();
      }
    }
  }

  attach(parent: IAttachable | string): this {
    if (this.pipelineIndex >= this._pipeline.length) {
      this.destroy();
    }
    return super.attach(parent);
  }

  attachToRoot(): this {
    if (this.pipelineIndex >= this._pipeline.length) {
      this.destroy();
    }
    return super.attachToRoot();
  }

  private iteratePackage(): void {
    if (!this.destroyed) {
      if (this.pipelineIndex < this._pipeline.length) {
        this.ongoingContext = new SingleEventContext(this);

        this._pipeline[this.pipelineIndex](this.currentData, this.ongoingContext, returnData => {
          this.ongoingContext?.destroyAttachment();
          this.ongoingContext = undefined;

          this.currentData = returnData;
          this.pipelineIndex++;
          this.iteratePackage();
        });
      } else {
        if (!this.attachIsCalled) {
          this.pending = true;
        } else {
          this.destroy();
        }
      }
    }
  }
}

export class SingleEvent<T = void> implements IAttachment {
  static create<S = void>(
    executor: (resolve: (data: S) => void, context: ISingleEventContext) => (() => void) | void
  ): SingleEvent<S> {
    let sequenceExecutor = new SingleEventExecuter();

    try {
      let destroyCallback = executor(sequenceExecutor.trigger.bind(sequenceExecutor), {
        attachable: sequenceExecutor
      });
      if (destroyCallback) {
        sequenceExecutor.onDestroyListeners.add(destroyCallback);
      }
    } catch (e) {
      console.error(e);
    }

    return new SingleEvent<S>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this.executor.destroyed;
  }

  get attachIsCalled(): boolean {
    return this.executor.attachIsCalled;
  }

  private linked = false;

  private constructor(private executor: SingleEventExecuter) {}

  read(callback: (data: T, context: ISingleEventContext) => void): SingleEvent<T> {
    this.prepareToBeLinked();

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

  map<K>(callback: (data: T, context: ISingleEventContext) => NotStream<K>): SingleEvent<K> {
    this.prepareToBeLinked();

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

  asyncMap<K>(callback: (data: T, context: ISingleEventContext) => StreamType<K>): SingleEvent<K> {
    this.prepareToBeLinked();

    this.executor.enterPipeline<T, K>((data, context, resolve) => {
      let executionReturn: StreamType<K>;

      try {
        executionReturn = callback(data, context);
      } catch (e) {
        console.error('SingleEvent callback function error: ', e);
        return;
      }

      executionReturn.subscribe(resolve).attach(context.attachable);
    });

    return new SingleEvent<K>(this.executor);
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
export const SingleEventClassNames = [SingleEvent.name, SingleEventExecuter.name];
