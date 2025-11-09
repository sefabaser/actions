import { Comparator, JsonHelper } from 'helpers-lib';

import { IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Notifier } from '../_notifier/notifier';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  readonly clone: boolean;
  readonly notifyOnChange: boolean;
}

export interface IVariable<T> {
  value: T;
  listenerCount: number;
  set(data: T): this;
  subscribe(callback: VariableListenerCallbackFunction<T>): IAttachment;
}

export class Variable<T> extends Notifier<T> implements IVariable<T> {
  get value(): T {
    return this.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  private currentValue!: T;

  constructor(value: T, partialOptions?: Partial<VariableOptions>) {
    super();
    this.currentValue = value;
    let options = {
      notifyOnChange: ActionLibDefaults.variable.notifyOnChange,
      clone: ActionLibDefaults.variable.cloneBeforeNotification,
      ...partialOptions
    };

    if (options.notifyOnChange) {
      this.set = options.clone ? this.notifyOnChangeCloneSet.bind(this) : this.notifyOnChangeNoCloneSet.bind(this);
    } else {
      this.set = options.clone ? this.notifyAlwaysCloneSet.bind(this) : this.notifyAlwaysNoCloneSet.bind(this);
    }
  }

  set(_: T): this {
    return this;
  }

  private notifyAlwaysNoCloneSet(data: T): this {
    this.currentValue = data;
    this.triggerAll(data);
    return this;
  }

  private notifyAlwaysCloneSet(data: T): this {
    this.currentValue = JsonHelper.deepCopy(data);
    this.triggerAll(data);
    return this;
  }

  private notifyOnChangeNoCloneSet(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = data;

    if (!Comparator.isEqual(previousData, data)) {
      this.triggerAll(data);
    }

    return this;
  }

  private notifyOnChangeCloneSet(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = JsonHelper.deepCopy(data);

    if (!Comparator.isEqual(previousData, data)) {
      this.triggerAll(data);
    }

    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>): IAttachment {
    CallbackHelper.triggerCallback(this.currentValue, callback);
    return super.subscribe(callback);
  }
}
