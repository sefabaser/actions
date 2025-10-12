import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { ActionSubscription } from '../notifier/notification-handler';
import { Notifier } from '../notifier/notifier';

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
  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription;
  waitUntilNext(callback: (data: T) => void): void;
  waitUntil(data: T, callback: (data: T) => void): void;
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
      this.notificationHandler.forEach(callback => this.notify(data, callback));
    }

    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>, options?: VariableSubscriptionOptions): ActionSubscription {
    if (!options?.listenOnlyNewChanges) {
      this.notify(this.currentValue, callback);
    }
    return super.subscribe(callback);
  }

  waitUntil(expectedData: T, callback: (data: T) => void): ActionSubscription {
    if (Comparator.isEqual(this.currentValue, expectedData)) {
      this.notify(expectedData, callback);
      return ActionSubscription.destroyed;
    } else {
      return super.waitUntil(expectedData, callback);
    }
  }
}
