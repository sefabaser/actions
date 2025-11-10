import { Comparator, JsonHelper } from 'helpers-lib';

import { IAttachable } from '../..';
import { Attachable, IAttachment } from '../../attachable/attachable';
import { AttachmentTargetStore } from '../../attachable/helpers/attachment-target.store';
import { Variable, VariableListenerCallbackFunction } from '../variable/variable';

export interface ObjectReferenceOptions<T extends number | object> {
  readonly initialValue?: T;
  readonly path: string;
}

export interface IDReferenceOptions<T extends number | object> {
  readonly initialValue?: T;
}

interface Options<T extends number | object> {
  readonly initialValue: T | undefined;
  readonly path: string | undefined;
}

export class Reference<T extends number | object = number> extends Attachable {
  get value(): T | undefined {
    if (this.destroyed) {
      return undefined;
    }

    return this.variable.value;
  }
  set value(value: T | undefined) {
    this.set(value);
  }

  get listenerCount(): number {
    if (this.destroyed) {
      return 0;
    }

    return this.variable.listenerCount;
  }

  private variable: Variable<T | undefined>;
  private destroySubscription: IAttachment | undefined;
  private options: Options<T>;

  constructor(...args: T extends number ? [options?: IDReferenceOptions<T>] : [options: ObjectReferenceOptions<T>]) {
    super();
    this.options = {
      initialValue: undefined,
      path: undefined,
      ...(args[0] as Partial<Options<T>>)
    };

    this.variable = new Variable<T | undefined>(undefined, { notifyOnChange: true });
    this.set(this.options.initialValue);
  }

  set(data: T | undefined): this {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be set!`);
    }

    if (data !== this.variable.value) {
      this.destroySubscription?.destroy();
      this.destroySubscription = undefined;

      if (data) {
        let referenceId = this.getReferenceId(data, this.options.path);
        this.destroySubscription = AttachmentTargetStore.findAttachmentTarget(referenceId).onDestroy(() => {
          !this.destroyed && this.set(undefined);
        });

        if (this.attachIsCalled) {
          if (this.attachedParent) {
            this.destroySubscription.attach(this.attachedParent);
          } else {
            this.destroySubscription.attachToRoot();
          }
        }
      }

      this.variable.set(data);
    }
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T | undefined>): IAttachment {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be subscribed to!`);
    }

    return this.variable.subscribe(callback);
  }

  attach(parent: IAttachable): this {
    super.attach(parent);
    this.destroySubscription?.attach(this.attachedParent!);
    return this;
  }

  attachById(id: number): this {
    super.attachById(id);
    this.destroySubscription?.attach(this.attachedParent!);
    return this;
  }

  attachToRoot(): this {
    super.attachToRoot();
    this.destroySubscription?.attachToRoot();
    return this;
  }

  destroy(): void {
    this.destroySubscription?.destroy();
    this.destroySubscription = undefined;
    this.variable = undefined as any;
    super.destroy();
  }

  private getReferenceId(value: T, path: string | undefined): number {
    if (Comparator.isNumber(value) && path === undefined) {
      return value;
    } else if (Comparator.isObject(value) && path !== undefined) {
      return JsonHelper.deepFind(value, path);
    } else {
      throw new Error(`Reference: the value and the path is not matching. Value type: "${typeof value}, path: "${path}"`);
    }
  }
}
