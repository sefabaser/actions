import { Attachable } from '../../attachable/attachable';
import { SequenceExecutor } from '../sequence/sequence-executor';

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
  _chainedFrom?: SequenceExecutor | SingleEventExecutor;
  private _pipeline: SingleEventPipelineIterator[] = [];
  private _pipelineIndex = 0;
  private _ongoingContext?: SingleEventContext;

  constructor() {
    super();
    this._destroyIfNotAttached = true;
  }

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
        this._chainedTo._final();
        this._chainedTo = undefined;
      }

      if (this._chainedFrom) {
        this._chainedFrom._chainedTo = undefined;
        this._chainedFrom.destroy();
        this._chainedFrom = undefined;
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
      this._destroyIfNotAttached = undefined;
      this._pipeline.push(iterator);
    }
  }

  _final() {
    if (!this._resolved) {
      this.destroy();
    }
  }

  attach(parent: Attachable): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }

    super.attach(parent);

    if (this._chainedFrom) {
      this._chainedFrom.attach(parent);
    }
    return this;
  }

  attachByID(id: number): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }

    super.attachByID(id);

    if (this._chainedFrom) {
      this._chainedFrom.attachByID(id);
    }
    return this;
  }

  attachToRoot(): this {
    if (this._resolved) {
      this._iteratePackage(this._currentData);
    }

    super.attachToRoot();

    if (this._chainedFrom) {
      this._chainedFrom.attachToRoot();
    }
    return this;
  }

  private _iteratePackage(data: unknown): void {
    if (!this._destroyed) {
      if (this._pipelineIndex < this._pipeline.length) {
        this._ongoingContext = new SingleEventContext(this);

        this._pipeline[this._pipelineIndex](data, this._ongoingContext, this._resolve);
      } else {
        if (this._chainedTo) {
          this._chainedTo._trigger(data);
        }
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
