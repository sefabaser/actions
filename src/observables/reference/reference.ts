import { Comparator, JsonHelper } from 'helpers-lib';

import { Attachable } from '../..';
import { IAttachment } from '../../attachable/attachable';
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
    if (this._destroyed) {
      return undefined;
    }

    return this._variable.value;
  }
  set value(value: T | undefined) {
    this.set(value);
  }

  get listenerCount(): number {
    if (this._destroyed) {
      return 0;
    }

    return this._variable.listenerCount;
  }

  private _variable: Variable<T | undefined>;
  private _destroySubscription: IAttachment | undefined;
  private _options: Options<T>;

  constructor(...args: T extends number ? [options?: IDReferenceOptions<T>] : [options: ObjectReferenceOptions<T>]) {
    super();
    this._options = {
      initialValue: undefined,
      path: undefined,
      ...(args[0] as Partial<Options<T>>)
    };

    this._variable = new Variable<T | undefined>(undefined, { notifyOnChange: true });
    this.set(this._options.initialValue);
  }

  set(data: T | undefined): this {
    if (this._destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be set!`);
    }

    if (data !== this._variable.value) {
      this._destroySubscription?.destroy();
      this._destroySubscription = undefined;

      if (data) {
        let referenceID = this._getReferenceID(data, this._options.path);
        this._destroySubscription = AttachmentTargetStore._findAttachmentTarget(referenceID)
          .onDestroy()
          .tap(() => !this._destroyed && this.set(undefined));

        if (this.attachIsCalled) {
          if (this.attachedParent) {
            this._destroySubscription.attach(this.attachedParent);
          } else {
            this._destroySubscription.attachToRoot();
          }
        }
      }

      this._variable.set(data);
    }
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T | undefined>): IAttachment {
    if (this._destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be subscribed to!`);
    }

    return this._variable.subscribe(callback);
  }

  attach(parent: Attachable): this {
    super.attach(parent);
    this._destroySubscription?.attach(this.attachedParent!);
    return this;
  }

  attachByID(id: number): this {
    super.attachByID(id);
    this._destroySubscription?.attach(this.attachedParent!);
    return this;
  }

  attachToRoot(): this {
    super.attachToRoot();
    this._destroySubscription?.attachToRoot();
    return this;
  }

  destroy(): void {
    this._destroySubscription?.destroy();
    this._destroySubscription = undefined;
    this._variable = undefined as any;
    super.destroy();
  }

  private _getReferenceID(value: T, path: string | undefined): number {
    if (Comparator.isNumber(value) && path === undefined) {
      return value;
    } else if (Comparator.isObject(value) && path !== undefined) {
      return JsonHelper.deepFind(value, path);
    } else {
      throw new Error(`Reference: the value and the path is not matching. Value type: "${typeof value}, path: "${path}"`);
    }
  }
}
