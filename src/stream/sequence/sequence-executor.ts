import { Attachable, IAttachment } from '../../attachable/attachable';

type SequencePipelineDestructor = (finalContext?: SequenceContext) => void;
type SequencePipelineIterator<A = unknown, B = unknown> = (
  data: A,
  context: ISequenceLinkContext,
  callback: (returnData: B) => void
) => void;

/** @internal */
export interface ISequenceCreatorContext {
  attachable: Attachable;
  final(): void;
  destroy(): void;
}

/** @internal */
export interface ISequenceLinkContext {
  attachable: Attachable;
  final(): void;
  drop(): void;
  destroy(): void;
}

class SequencePackage {
  pipelineIndex = 0;
  ongoingContext?: SequenceContext;

  constructor(public data: unknown) {}

  destroyAttachment() {
    this.ongoingContext?._attachable?.destroy();
  }
}

/** @internal */
export class SequenceContext implements ISequenceLinkContext {
  /** @internal */
  _attachable?: Attachable;
  get attachable(): Attachable {
    if (!this._attachable) {
      this._attachable = new Attachable().attach(this.executor);
    }
    return this._attachable;
  }

  constructor(
    private executor: SequenceExecutor,
    private sequencePackage: SequencePackage
  ) {}

  destroy(): void {
    this.executor.destroy();
  }

  final() {
    if (this.executor.asyncPipelineIndices) {
      for (let index of this.executor.asyncPipelineIndices) {
        if (index > this.sequencePackage.pipelineIndex) {
          break;
        } else {
          this.executor.pipeline[index].destructor!(
            index === this.sequencePackage.pipelineIndex ? this.sequencePackage.ongoingContext : undefined
          );
        }
      }
    }
    this.executor.final();
  }

  drop(): void {
    this.sequencePackage.destroyAttachment();
    this.executor.ongoingPackageCount--;
  }
}

/** @internal */
export class SequenceExecutor extends Attachable {
  private _onDestroyListeners?: Set<() => void>;
  get onDestroyListeners(): Set<() => void> {
    if (!this._onDestroyListeners) {
      this._onDestroyListeners = new Set();
    }
    return this._onDestroyListeners;
  }

  pipeline: { iterator: SequencePipelineIterator; destructor?: SequencePipelineDestructor }[] = [];
  asyncPipelineIndices?: Set<number>;
  ongoingPackageCount = 0;
  chainedTo?: IAttachment;
  private _pendingValues?: unknown[];
  private _finalized?: boolean;

  constructor() {
    super(true);
  }

  destroy(): void {
    if (!this.destroyed) {
      super.destroy();

      this.pipeline = undefined as any;
      this._pendingValues = undefined as any;

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
    if (!this._finalized && !this.destroyed) {
      if (this.attachIsCalled) {
        this.ongoingPackageCount++;
        this.iteratePackage(new SequencePackage(data));
      } else {
        if (!this._pendingValues) {
          this._pendingValues = [];
        }
        this._pendingValues.push(data);
        this.ongoingPackageCount++;
      }
    }
  }

  enterPipeline<A, B>(iterator: SequencePipelineIterator<A, B>, destructor?: SequencePipelineDestructor) {
    if (!this.destroyed) {
      this.destroyIfNotAttached = false;

      if (destructor) {
        if (!this.asyncPipelineIndices) {
          this.asyncPipelineIndices = new Set();
        }
        this.asyncPipelineIndices.add(this.pipeline.length);
      }

      this.pipeline.push({ iterator, destructor });
    }
  }

  final() {
    if (this.attachIsCalled && this.ongoingPackageCount === 0) {
      this.destroy();
    } else {
      this._finalized = true;
    }
  }

  attach(parent: Attachable): this {
    this.onAttach();
    return super.attach(parent);
  }

  attachByID(id: number): this {
    this.onAttach();
    return super.attachByID(id);
  }

  attachToRoot(): this {
    this.onAttach();
    return super.attachToRoot();
  }

  private onAttach(): void {
    if (this._pendingValues) {
      let pendingValues = this._pendingValues;
      this._pendingValues = undefined;
      let startedAsFinalized = this._finalized;

      for (let i = 0; i < pendingValues.length; i++) {
        if (startedAsFinalized === this._finalized) {
          this.iteratePackage(new SequencePackage(pendingValues[i]));
        }
      }
    }
  }

  private iteratePackage(sequencePackage: SequencePackage): void {
    if (!this.destroyed) {
      if (sequencePackage.pipelineIndex < this.pipeline.length) {
        let context = new SequenceContext(this, sequencePackage);
        sequencePackage.ongoingContext = context;

        this.pipeline[sequencePackage.pipelineIndex].iterator(sequencePackage.data, context, returnData => {
          sequencePackage.destroyAttachment();
          sequencePackage.ongoingContext = undefined;

          sequencePackage.data = returnData;
          sequencePackage.pipelineIndex++;
          this.iteratePackage(sequencePackage);
        });
      } else {
        sequencePackage.destroyAttachment();
        this.ongoingPackageCount--;

        if (this._finalized && this.ongoingPackageCount === 0) {
          this.destroy();
        }
      }
    }
  }
}
