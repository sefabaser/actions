import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { DestroyablePromise } from '../destroyable-promise/destroyable-promise';

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
  waitUntilNextPromise(): DestroyablePromise<T>;
  waitUntilPromise(data: T): DestroyablePromise<T>;
}

export class Variable<T> implements IVariable<T> {
  get value(): T {
    return this.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  get listenerCount(): number {
    return this.notificationHandler.listenerCount;
  }

  private notificationHandler = new NotificationHandler<T>();
  private nextListeners = new Set<(data: T) => void>();
  private untilListeners = new Set<{ expected: T; callback: (data: T) => void }>();

  private currentValue!: T;
  private firstTriggerHappened = false;
  private notifyOnlyOnChange: boolean;
  private clone: boolean;

  constructor(options: VariableOptions = {}) {
    this.notifyOnlyOnChange =
      options.notifyOnChange !== undefined ? options.notifyOnChange : ActionLibDefaults.variable.notifyOnChange;
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.variable.cloneBeforeNotification;
  }

  set(data: T): this {
    if (this.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    let previousData = this.currentValue;
    this.currentValue = this.clone ? JsonHelper.deepCopy(data) : data;
    if (!this.notifyOnlyOnChange || !Comparator.isEqual(previousData, data)) {
      this.notificationHandler.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
      });
    }

    this.nextListeners.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    });
    this.nextListeners = new Set();

    this.untilListeners.forEach(item => {
      if (Comparator.isEqual(item.expected, data)) {
        try {
          item.callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
        this.untilListeners.delete(item);
      }
    });

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

    return this.notificationHandler.subscribe(callback);
  }

  waitUntilNext(callback: (data: T) => void): ActionSubscription {
    this.nextListeners.add(callback);
    return new ActionSubscription(() => {
      this.nextListeners.delete(callback);
    });
  }

  waitUntil(data: T, callback: (data: T) => void): ActionSubscription {
    let item = { expected: data, callback: callback };
    this.untilListeners.add(item);
    return new ActionSubscription(() => {
      this.untilListeners.delete(item);
    });
  }

  waitUntilNextPromise(): DestroyablePromise<T> {
    return new DestroyablePromise(resolve => {
      this.nextListeners.add(data => {
        resolve(data);
      });
      return () => this.nextListeners.delete(resolve);
    });
  }

  waitUntilPromise(data: T): DestroyablePromise<T> {
    return new DestroyablePromise<T>(resolve => {
      let item = { expected: data, callback: resolve };
      this.untilListeners.add(item);
      return () => this.untilListeners.delete(item);
    });
  }
}
