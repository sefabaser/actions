import { Comparator, JsonHelper } from 'helpers-lib';

import { Attachable } from '../../attachable/attachable';
import { AttachmentTargetStore } from '../../attachable/helpers/attachment-target.store';
import { LightweightAttachable } from '../../attachable/lightweight-attachable';
import { ActionSubscription } from '../_notifier/action-subscription';
import { IVariable, Variable, VariableListenerCallbackFunction } from '../variable/variable';

export interface ObjectReferenceOptions<T> {
  readonly initialValue?: T;
  readonly path: string;
}

export interface StringReferenceOptions<T> {
  readonly initialValue?: T;
}

export class Reference<T = string> extends LightweightAttachable implements IVariable<T | undefined> {
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
  private destroySubscription: ActionSubscription | undefined;
  private options: { initialValue: T | undefined; path: string | undefined };

  constructor(
    ...args: T extends string ? [options?: StringReferenceOptions<T>] : [options: ObjectReferenceOptions<T>]
  ) {
    super();
    this.options = {
      initialValue: undefined,
      path: undefined,
      ...args[0]
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

        if (this._attachIsCalled) {
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

  subscribe(callback: VariableListenerCallbackFunction<T | undefined>): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be subscribed to!`);
    }

    return this.variable.subscribe(callback);
  }

  waitUntilNext(callback: (data: T | undefined) => void): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be waited until next!`);
    }

    return this.variable.waitUntilNext(callback);
  }

  waitUntil(data: T | undefined, callback: (data: T | undefined) => void): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be waited until!`);
    }

    return this.variable.waitUntil(data, callback);
  }

  attach(parent: Attachable | string): this {
    super.attach(parent);
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

  private getReferenceId(value: T, path: string | undefined): string {
    if (Comparator.isString(value) && path === undefined) {
      return value;
    } else if (Comparator.isObject(value) && path !== undefined) {
      return JsonHelper.deepFind(value, path);
    } else {
      throw new Error(`Reference: the value and the path is not matching. Value type: "${typeof value}, path: "${path}"`);
    }
  }
}
