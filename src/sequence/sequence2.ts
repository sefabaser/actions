import { Attachable, IAttachable } from '../attachable/attachable';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { Notifier, NotifierCallbackFunction } from '../observables/_notifier/notifier';

export type IStream<T> = Notifier<T> | Sequence2<T>;

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
    this._pipeline = undefined as any;

    this.trigger = () => {};
    this.enterPipeline = () => {};
    this.destroy = () => {};

    for (let item of this.onDestroyListeners) {
      item();
    }
    this.onDestroyListeners.clear();

    super.destroy();
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

export class Sequence2<T> implements IAttachable {
  static create<T>(executor: (resolve: (data: T) => void) => void, onDestroy?: () => void): Sequence2<T> {
    let sequenceExecutor = new SequenceExecuter();

    try {
      executor(sequenceExecutor.trigger.bind(sequenceExecutor));
    } catch (e) {
      console.error(e);
    }

    if (onDestroy) {
      sequenceExecutor.onDestroyListeners.add(onDestroy);
    }

    return new Sequence2<T>(sequenceExecutor);
  }

  get destroyed(): boolean {
    return this.executor.destroyed;
  }

  private constructor(private executor: SequenceExecuter) {}

  read(callback: (data: T) => void): Sequence2<T> {
    this.executor.enterPipeline<T, T>((data, resolve) => {
      try {
        callback(data);
      } catch (e) {
        console.error(e);
      }

      resolve(data);
    });
    return this;
  }

  map<K>(callback: (data: T) => K | IStream<K>): Sequence2<K> {
    this.executor.enterPipeline<T, K>((data, resolve) => {
      let executionReturn = callback(data);

      if (executionReturn instanceof Sequence2 || executionReturn instanceof Notifier) {
        let destroyedDirectly = false;
        let destroyListener = () => subscription.destroy();

        let subscription: { destroy: () => void } = undefined as any;
        subscription = executionReturn
          .subscribe(innerData => {
            if (subscription) {
              subscription.destroy();
              this.executor.onDestroyListeners.delete(destroyListener);
            } else {
              destroyedDirectly = true;
            }

            resolve(innerData);
          })
          .attachToRoot();
        if (!destroyedDirectly) {
          this.executor.onDestroyListeners.add(destroyListener);
        }
      } else {
        resolve(executionReturn);
      }
    });

    return this as unknown as Sequence2<K>;
  }

  /** @internal */
  get subscribe(): (callback: NotifierCallbackFunction<T>) => IAttachable {
    return this.read.bind(this);
  }

  destroy(): void {
    this.executor.destroy();
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
