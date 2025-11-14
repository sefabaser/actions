import { Attachable } from '../../attachable/attachable';

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

  constructor(private executor: SingleEventExecutor) {}

  destroy(): void {
    this.executor.destroy();
  }

  /** @internal */
  drop() {
    this._attachable?.destroy();
  }
}

/** @internal */
export class SingleEventExecutor extends Attachable {
  private _onDestroyListeners?: Set<() => void>;
  get onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListeners) {
      this._onDestroyListeners = new Set();
    }
    return this._onDestroyListeners;
  }

  resolved = false;
  currentData: unknown;
  chainedTo?: SingleEventExecutor;
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

      if (this.chainedTo) {
        this.chainedTo.destroy();
        this.chainedTo = undefined;
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
