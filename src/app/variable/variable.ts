import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  clone?: boolean;
  notifyOnChange?: boolean;
}

export interface IVariable<T> {
  value: T;
  listenerCount: number;
  set(data: T): this;
  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription;
  waitUntilNextCallback(callback: (data: T) => void): void;
  waitUntilNext(): Promise<T>;
  waitUntilCallback(data: T, callback: (data: T) => void): void;
  waitUntil(data: T): Promise<T>;
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

  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription {
    if (this.firstTriggerHappened) {
      try {
        callback(this.currentValue);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    }

    return this.notificationHandler.subscribe(callback);
  }

  waitUntilNextCallback(callback: (data: T) => void): void {
    this.nextListeners.add(callback);
  }

  async waitUntilNext(): Promise<T> {
    return new Promise(resolve => {
      this.waitUntilNextCallback(resolve);
    });
  }

  waitUntilCallback(data: T, callback: (data: T) => void): void {
    if (Comparator.isEqual(this.value, data)) {
      try {
        callback(data);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    } else {
      this.untilListeners.add({ expected: data, callback });
    }
  }

  async waitUntil(data: T): Promise<T> {
    return new Promise(resolve => {
      this.waitUntilCallback(data, resolve);
    });
  }
}
