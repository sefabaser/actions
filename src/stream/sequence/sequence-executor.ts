import { Attachable, IAttachment } from '../../attachable/attachable';

type SequencePipelineDestructor = (finalContext?: SequenceContext) => void;
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
  _ongoingContext?: SequenceContext;

  constructor(public data: unknown) {}

  _destroyAttachment() {
    this._ongoingContext?._attachableVar?.destroy();
  }
}

/** @internal */
export class SequenceContext implements ISequenceLinkContext {
  _attachableVar?: Attachable;
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
}

/** @internal */
export class SequenceExecutor extends Attachable {
  private _onDestroyListenersVar?: Set<() => void>;
  get _onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListenersVar) {
      this._onDestroyListenersVar = new Set();
    }
    return this._onDestroyListenersVar;
  }

  _pipeline: { iterator: SequencePipelineIterator; destructor?: SequencePipelineDestructor }[] = [];
  _asyncPipelineIndices?: Set<number>;
  _ongoingPackageCount = 0;
  _chainedTo?: IAttachment;
  _pendingValues?: unknown[];
  private _finalized?: boolean;

  constructor() {
    super(true);
  }

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this._pipeline = undefined as any;
      this._pendingValues = undefined as any;

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
    if (!this._finalized && !this.destroyed) {
      if (this._attachIsCalled) {
        this._ongoingPackageCount++;
        this._iteratePackage(new SequencePackage(data));
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
    if (!this.destroyed) {
      this.destroyIfNotAttached = false;

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
    if (this._attachIsCalled && this._ongoingPackageCount === 0) {
      this.destroy();
    } else {
      this._finalized = true;
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

  private _onAttach(): void {
    if (this._pendingValues) {
      let pendingValues = this._pendingValues;
      this._pendingValues = undefined;
      let startedAsFinalized = this._finalized;

      for (let i = 0; i < pendingValues.length; i++) {
        if (startedAsFinalized === this._finalized) {
          this._iteratePackage(new SequencePackage(pendingValues[i]));
        }
      }
    }
  }

  private _iteratePackage(sequencePackage: SequencePackage): void {
    if (!this.destroyed) {
      if (sequencePackage._pipelineIndex < this._pipeline.length) {
        let context = new SequenceContext(this, sequencePackage);
        sequencePackage._ongoingContext = context;

        this._pipeline[sequencePackage._pipelineIndex].iterator(sequencePackage.data, context, returnData => {
          sequencePackage._destroyAttachment();
          sequencePackage._ongoingContext = undefined;

          sequencePackage.data = returnData;
          sequencePackage._pipelineIndex++;
          this._iteratePackage(sequencePackage);
        });
      } else {
        sequencePackage._destroyAttachment();
        this._ongoingPackageCount--;

        if (this._finalized && this._ongoingPackageCount === 0) {
          this.destroy();
        }
      }
    }
  }
}
