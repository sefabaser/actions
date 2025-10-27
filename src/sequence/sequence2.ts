import { Attachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { Notifier } from '../observables/_notifier/notifier';

export type IStream<T> = Notifier<T> | Sequence2<T>;
export type SequenceTouchFunction<T, K> = (data: T) => K | IStream<K>;

type SequencePipelineItem<A, B> = (data: A, callback: (returnData: B) => void) => void;

class SequenceExecuter extends LightweightAttachable {
  onDestroyListeners = new Set<() => void>();

  private _pipeline: SequencePipelineItem<unknown, unknown>[] = [];
  private _pendingValues: unknown[] | undefined;

  trigger(data: unknown, index = 0): void {
    if (index < this._pipeline.length) {
      let item = this._pipeline[index];
      item(data, returnData => this.trigger(returnData, index + 1));
    } else {
      if (!this.attachIsCalled) {
        if (!this._pendingValues) {
          this._pendingValues = [];
        }
        this._pendingValues.push(data);
      }
    }
  }

  enterPipeline<A, B>(item: SequencePipelineItem<A, B>) {
    if (this._attachIsCalled) {
      throw new Error('After attaching a sequence you cannot add another operation.');
    }

    this._pipeline.push(item);
    if (this._pendingValues) {
      let pendingValues = this._pendingValues;
      this._pendingValues = [];
      let itemIndex = this._pipeline.length - 1;

      for (let i = 0; i < pendingValues.length; i++) {
        let value = pendingValues[i];
        this.trigger(value, itemIndex);
      }
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      this._pipeline = undefined as any;
      for (let item of this.onDestroyListeners) {
        item();
      }
      this.onDestroyListeners.clear();
    }
  }

  attach(parent: string | Attachable): this {
    this._pendingValues = undefined;
    return super.attach(parent);
  }

  attachToRoot(): this {
    this._pendingValues = undefined;
    return super.attachToRoot();
  }
}

export class Sequence2<T> extends LightweightAttachable {
  static create<T>(executor: (resolve: (data: T) => void) => void, onDestroy?: () => void): Sequence2<T> {
    let sequenceExecutor = new SequenceExecuter();
    executor(data => sequenceExecutor.trigger(data));
    if (onDestroy) {
      sequenceExecutor.onDestroyListeners.add(onDestroy);
    }
    return new Sequence2(sequenceExecutor);
  }

  private constructor(private executor: SequenceExecuter) {
    super();
    this._attachIsCalled = true;
  }

  destroy(): void {
    this.executor.destroy();
    super.destroy();
  }

  read(callback: (data: T) => void): Sequence2<T> {
    this.executor.enterPipeline<T, T>((data, resolve) => {
      callback(data as T);
      resolve(data);
    });
    return this;
  }

  attach(parent: string | Attachable): this {
    this.executor.attach(parent);
    return this;
  }

  attachToRoot(): this {
    this.executor.attachToRoot();
    return this;
  }
}
