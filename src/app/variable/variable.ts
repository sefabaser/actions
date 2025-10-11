import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { ActionSubscription } from '../../helpers/notification-handler';
import { Action } from '../action/action';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  clone?: boolean;
  notifyOnChange?: boolean;
}

export interface VariableSubscriptionOptions {
  listneOnlyNewChanges?: boolean;
}

export interface IVariable<T> {
  value: T;
  listenerCount: number;
  set(data: T): this;
  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription;
  waitUntilNext(callback: (data: T) => void): void;
  waitUntil(data: T, callback: (data: T) => void): void;
}

export class Variable<T> implements IVariable<T> {
  get value(): T {
    return this.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  get listenerCount(): number {
    return this.action.listenerCount;
  }

  private action: Action<T>;
  private currentValue!: T;
  private firstTriggerHappened = false;

  private notifyOnlyOnChange: boolean;
  private clone: boolean;

  constructor(options: VariableOptions = {}) {
    this.notifyOnlyOnChange =
      options.notifyOnChange !== undefined ? options.notifyOnChange : ActionLibDefaults.variable.notifyOnChange;
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.variable.cloneBeforeNotification;

    this.action = new Action<T>({ clone: this.clone });
  }

  set(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = this.clone && Comparator.isObject(data) ? JsonHelper.deepCopy(data) : data;

    if (!this.notifyOnlyOnChange || !Comparator.isEqual(previousData, data)) {
      this.action.trigger(data);
    }

    this.firstTriggerHappened = true;
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>, options?: VariableSubscriptionOptions): ActionSubscription {
    if (this.firstTriggerHappened && !options?.listneOnlyNewChanges) {
      try {
        callback(this.currentValue);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    }

    return this.action.subscribe(callback);
  }

  waitUntilNext(callback: (data: T) => void): ActionSubscription {
    return this.action.waitUntilNext(callback);
  }

  waitUntil(data: T, callback: (data: T) => void): ActionSubscription {
    return this.action.waitUntil(data, callback);
  }
}
