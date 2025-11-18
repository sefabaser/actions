import { Attachable } from '../../attachable/attachable';

type SingleEventPipelineIterator<A = unknown, B = unknown> = (
  _data: A,
  _context: SingleEventContext,
  _callback: (returnData: B) => void
) => void;

export interface ISingleEventContext {
  readonly attachable: Attachable;
  destroy(): void;
}

class SingleEventContext implements ISingleEventContext {
  private _attachable?: Attachable;
  get attachable(): Attachable {
    if (!this._attachable) {
      this._attachable = new Attachable().attach(this._executor);
    }
    return this._attachable;
  }

  constructor(private _executor: SingleEventExecutor) {}

  destroy(): void {
    this._executor.destroy();
  }

  /** @internal */
  _drop() {
    this._attachable?.destroy();
  }
}

/** @internal */
export class SingleEventExecutor extends Attachable {
  private _onDestroyListenersVar?: Set<() => void>;
  get _onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListenersVar) {
      this._onDestroyListenersVar = new Set();
    }
    return this._onDestroyListenersVar;
  }

  _resolved?: boolean;
  _currentData: unknown;
  _chainedTo?: SingleEventExecutor;
  private _pipeline: SingleEventPipelineIterator[] = [];
  private _pipelineIndex = 0;
  private _ongoingContext?: SingleEventContext;

  destroy(): void {
    if (!this._destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._currentData = undefined;
      this._ongoingContext?._drop();

      if (this._onDestroyListenersVar) {
        let listeners = this._onDestroyListenersVar;
        this._onDestroyListenersVar = undefined as any;
        for (let listener of listeners) {
          listener();
        }
      }

      if (this._chainedTo) {
        this._chainedTo.destroy();
        this._chainedTo = undefined;
      }
    }
  }

  _trigger(data: unknown): void {
    if (this._resolved) {
      throw new Error('Single Event: It can only resolve once.');
    }

    if (!this._destroyed) {
      this._resolved = true;
      this._currentData = data;

      if (this.attachIsCalled) {
        this._iteratePackage(this._currentData);
      }
    }
  }

  _enterPipeline<A, B>(iterator: SingleEventPipelineIterator<A, B>) {
    if (!this._destroyed) {
      this._pipeline.push(iterator);
    }
  }

  attach(parent: Attachable): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }
    return super.attach(parent);
  }

  attachByID(id: number): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }
    return super.attachByID(id);
  }

  attachToRoot(): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }
    return super.attachToRoot();
  }

  private _iteratePackage(data: unknown): void {
    if (!this._destroyed) {
      if (this._pipelineIndex < this._pipeline.length) {
        this._ongoingContext = new SingleEventContext(this);

        this._pipeline[this._pipelineIndex](data, this._ongoingContext, this._resolve);
      } else {
        this.destroy();
      }
    }
  }

  private _resolve = (returnData: unknown) => {
    this._ongoingContext?._drop();
    this._ongoingContext = undefined;

    this._pipelineIndex++;
    this._iteratePackage(returnData);
  };
}
