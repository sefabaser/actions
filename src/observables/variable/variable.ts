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

export interface VariableSubscriptionOptions {
  readonly listenOnlyNewChanges: boolean;
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

  private options: VariableOptions;

  private currentValue!: T;

  constructor(value: T, options?: Partial<VariableOptions>) {
    super();
    this.currentValue = value;
    this.options = {
      notifyOnChange: ActionLibDefaults.variable.notifyOnChange,
      clone: ActionLibDefaults.variable.cloneBeforeNotification,
      ...options
    };
  }

  set(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = this.options.clone && Comparator.isObject(data) ? JsonHelper.deepCopy(data) : data;

    if (!this.options.notifyOnChange || !Comparator.isEqual(previousData, data)) {
      this.forEach(callback => CallbackHelper.triggerCallback(data, callback));
    }

    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>, options?: VariableSubscriptionOptions): IAttachment {
    if (!options?.listenOnlyNewChanges) {
      CallbackHelper.triggerCallback(this.currentValue, callback);
    }
    return super.subscribe(callback);
  }
}
