import { Attachable } from '../../attachable/attachable';
import { SingleEventExecutor } from '../single-event/single-event-executor';

type SequencePipelineDestructor = (finalContext?: ISequenceLinkContext) => void;
type SequencePipelineIterator<A = unknown, B = unknown> = (
  _data: A,
  _context: ISequenceLinkContext,
  _callback: (returnData: B) => void
) => void;

export interface ISequenceCreatorContext {
  attachable: Attachable;
  final(): void;
  destroy(): void;
}

export interface ISequenceLinkContext {
  attachable: Attachable;
  final(): void;
  drop(): void;
  destroy(): void;
}

class SequencePackage {
  _pipelineIndex = 0;
  _ongoingContext!: SequenceLinkContext;

  constructor(
    _executor: SequenceExecutor,
    public _data: unknown
  ) {
    this._ongoingContext = new SequenceLinkContext(_executor, this);
  }

  _destroyAttachment() {
    this._ongoingContext._destroyAttachment();
  }
}

class SeqeunceCreatorContext implements ISequenceCreatorContext {
  _attachableVar?: Attachable;
  get attachable(): Attachable {
    if (!this._attachableVar) {
      this._attachableVar = new Attachable().attachToRoot();
    }
    return this._attachableVar;
  }

  constructor(private _executor: SequenceExecutor) {}

  final(): void {
    this._executor._final();
  }

  destroy(): void {
    this._executor.destroy();
  }

  _destroyAttachment() {
    this._attachableVar?.destroy();
  }
}

class SequenceLinkContext implements ISequenceLinkContext {
  private _attachableVar?: Attachable;
  get attachable(): Attachable {
    if (!this._attachableVar) {
      this._attachableVar = new Attachable().attach(this._executor);
    }
    return this._attachableVar;
  }

  constructor(
    private _executor: SequenceExecutor,
    private _sequencePackage: SequencePackage
  ) {}

  destroy(): void {
    this._executor.destroy();
  }

  final() {
    if (this._executor._asyncPipelineIndices) {
      for (let index of this._executor._asyncPipelineIndices) {
        if (index > this._sequencePackage._pipelineIndex) {
          break;
        } else {
          this._executor._pipeline[index].destructor!(
            index === this._sequencePackage._pipelineIndex ? this._sequencePackage._ongoingContext : undefined
          );
        }
      }
    }
    this._executor._final();
  }

  drop(): void {
    this._sequencePackage._destroyAttachment();
    this._executor._ongoingPackageCount--;
  }

  /** @internal */
  _destroyAttachment() {
    this._attachableVar?.destroy();
    this._attachableVar = undefined;
  }
}

/** @internal */
export class SequenceExecutor extends Attachable {
  _onDestroyListener?: () => void;
  _onFinalListener?: () => void;

  _pipeline: { iterator: SequencePipelineIterator; destructor?: SequencePipelineDestructor }[] = [];
  _asyncPipelineIndices?: Set<number>;
  _ongoingPackageCount = 0;
  _chainedTo?: SequenceExecutor | SingleEventExecutor;
  _destroyAfterFirstPackage?: boolean;
  _pendingValues?: unknown[];
  _finalized?: boolean;
  private _creatorContext?: SeqeunceCreatorContext;

  destroy(): void {
    if (!this._destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._pendingValues = undefined as any;

      this._onFinalHandler();
      this._onDestroyListener?.();

      if (this._chainedTo) {
        this._chainedTo._final();
        this._chainedTo = undefined;
      }
    }
  }

  _trigger(data: unknown): void {
    if (!this._finalized) {
      if (this.attachIsCalled) {
        this._ongoingPackageCount++;
        this._iteratePackage(new SequencePackage(this, data));
      } else {
        if (!this._pendingValues) {
          this._pendingValues = [];
        }
        this._pendingValues.push(data);
        this._ongoingPackageCount++;
      }
    }
  }

  _enterPipeline<A, B>(iterator: SequencePipelineIterator<A, B>, destructor?: SequencePipelineDestructor) {
    if (!this._destroyed) {
      this._destroyIfNotAttached = undefined;

      if (destructor) {
        if (!this._asyncPipelineIndices) {
          this._asyncPipelineIndices = new Set();
        }
        this._asyncPipelineIndices.add(this._pipeline.length);
      }

      this._pipeline.push({ iterator, destructor });
    }
  }

  _final() {
    this._onFinalHandler();

    if (this.attachIsCalled && this._ongoingPackageCount === 0) {
      this.destroy();
    }
  }

  attach(parent: Attachable): this {
    this._onAttach();
    return super.attach(parent);
  }

  attachByID(id: number): this {
    this._onAttach();
    return super.attachByID(id);
  }

  attachToRoot(): this {
    this._onAttach();
    return super.attachToRoot();
  }

  destroyIfNotAttached(): void {
    this._destroyIfNotAttached = true;
  }

  _getCreatorContext(): ISequenceCreatorContext {
    this._creatorContext = new SeqeunceCreatorContext(this);
    return this._creatorContext;
  }

  private _onAttach(): void {
    if (this._pendingValues) {
      let pendingValues = this._pendingValues;
      this._pendingValues = undefined;
      let startedAsFinalized = this._finalized;

      for (let i = 0; i < pendingValues.length; i++) {
        if (startedAsFinalized === this._finalized) {
          this._iteratePackage(new SequencePackage(this, pendingValues[i]));
        }
      }
    }
  }

  private _iteratePackage(sequencePackage: SequencePackage): void {
    if (!this._destroyed) {
      if (sequencePackage._pipelineIndex < this._pipeline.length) {
        this._pipeline[sequencePackage._pipelineIndex].iterator(
          sequencePackage._data,
          sequencePackage._ongoingContext,
          returnData => {
            sequencePackage._destroyAttachment();

            sequencePackage._data = returnData;
            sequencePackage._pipelineIndex++;
            this._iteratePackage(sequencePackage);
          }
        );
      } else {
        if (this._chainedTo) {
          this._chainedTo._trigger(sequencePackage._data);
          if (this._destroyAfterFirstPackage) {
            this.destroy();
          }
        }

        sequencePackage._destroyAttachment();
        this._ongoingPackageCount--;

        if (this._finalized && this._ongoingPackageCount === 0) {
          this.destroy();
        }
      }
    }
  }

  private _onFinalHandler(): void {
    if (!this._finalized) {
      this._finalized = true;
      this._onFinalListener?.();
      this._creatorContext?._destroyAttachment();
    }
  }
}
