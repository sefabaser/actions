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
      this._attachable = new Attachable();
      if (this._attachToExecutor) {
        this._attachable.attach(this._executor);
      } else {
        this._attachable.attachToRoot();
      }
    }
    return this._attachable;
  }

  constructor(
    private _executor: SingleEventExecutor,
    private _attachToExecutor = true
  ) {}

  destroy(): void {
    this._executor.destroy();
  }

  /** @internal */
  _destroyAttachment() {
    this._attachable?.destroy();
    this._attachable = undefined;
  }
}

/** @internal */
export class SingleEventExecutor extends Attachable {
  _onDestroyListener?: () => void;
  _onFinalListener?: () => void;

  _resolved?: boolean;
  _finalized?: boolean;
  _currentData: unknown;
  _chainedTo?: SingleEventExecutor;
  _entangledFrom?: SequenceExecutor;
  private _pipeline: SingleEventPipelineIterator[] = [];
  private _pipelineIndex = 0;
  private _creatorContext?: SingleEventContext;
  private _ongoingContext?: SingleEventContext;

  destroy(): void {
    if (!this._destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._currentData = undefined;
      this._ongoingContext?._destroyAttachment();

      this._onFinalHandler();
      this._onDestroyListener?.();

      if (this._chainedTo) {
        this._chainedTo._final();
        this._chainedTo = undefined;
      }

      if (this._entangledFrom) {
        this._entangledFrom._chainedTo = undefined;
        this._entangledFrom.destroy();
        this._entangledFrom = undefined;
      }
    }
  }

  _trigger(data: unknown): void {
    if (!this._resolved && !this._destroyed) {
      this._resolved = true;
      this._currentData = data;
      this._onFinalHandler();

      if (this.attachIsCalled) {
        this._ongoingContext = new SingleEventContext(this);
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
    this._onFinalHandler();

    if (!this._resolved) {
      this.destroy();
    }
  }

  attach(parent: Attachable): this {
    if (this._resolved) {
      this._ongoingContext = new SingleEventContext(this);
      this._iteratePackage(this._currentData);
    }

    super.attach(parent);

    if (this._entangledFrom) {
      this._entangledFrom.attach(parent);
    }
    return this;
  }

  attachByID(id: number): this {
    if (this._resolved) {
      this._ongoingContext = new SingleEventContext(this);
      this._iteratePackage(this._currentData);
    }

    super.attachByID(id);

    if (this._entangledFrom) {
      this._entangledFrom.attachByID(id);
    }
    return this;
  }

  attachToRoot(): this {
    if (this._resolved) {
      this._ongoingContext = new SingleEventContext(this);
      this._iteratePackage(this._currentData);
    }

    super.attachToRoot();

    if (this._entangledFrom) {
      this._entangledFrom.attachToRoot();
    }
    return this;
  }

  destroyIfNotAttached(): void {
    this._destroyIfNotAttached = true;
  }

  _getCreatorContext(): ISingleEventContext {
    this._creatorContext = new SingleEventContext(this, false);
    return this._creatorContext;
  }

  private _iteratePackage(data: unknown): void {
    if (!this._destroyed) {
      if (this._pipelineIndex < this._pipeline.length) {
        this._pipeline[this._pipelineIndex](data, this._ongoingContext!, this._resolve);
      } else {
        if (this._chainedTo) {
          this._chainedTo._trigger(data);
        }
        this.destroy();
      }
    }
  }

  private _resolve = (returnData: unknown) => {
    this._ongoingContext?._destroyAttachment();

    this._pipelineIndex++;
    this._iteratePackage(returnData);
  };

  private _onFinalHandler(): void {
    if (!this._finalized) {
      this._finalized = true;
      this._onFinalListener?.();
      this._creatorContext?._destroyAttachment();
    }
  }
}
