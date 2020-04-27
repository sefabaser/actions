import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  clone?: boolean;
  notifyOnChange?: boolean;
}

export class Variable<T> {
  get value() {
    return this.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  get listenerCount() {
    return this.notificationHandler.listenerCount;
  }

  private notificationHandler = new NotificationHandler<T>();
  private nextListeners = new Set<(data: T) => void>();
  private untilListeners = new Set<{ expected: T; callback: (data: T) => void }>();

  private currentValue!: T;
  private firstTriggerHappened = false;
  private notifyOnlyOnChange: boolean;
  private clone: boolean;
  private destroyed = false;

  constructor(options: VariableOptions = {}) {
    this.notifyOnlyOnChange = options.notifyOnChange !== undefined ? options.notifyOnChange : ActionLibDefaults.variable.notifyOnChange;
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.variable.cloneBeforeNotification;
  }

  set(data: T): this {
    this.checkIfDestroyed();
    if (this.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    let previousData = this.currentValue;
    this.currentValue = this.clone ? JsonHelper.deepCopy(data) : data;
    if (!this.notifyOnlyOnChange || !Comparator.isEqual(previousData, data)) {
      this.notificationHandler.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
      });
    }

    this.nextListeners.forEach((callback) => callback(data));
    this.nextListeners = new Set();

    this.untilListeners.forEach((item) => {
      if (Comparator.isEqual(item.expected, data)) {
        item.callback(data);
        this.untilListeners.delete(item);
      }
    });

    this.firstTriggerHappened = true;
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription {
    this.checkIfDestroyed();
    if (this.firstTriggerHappened) {
      callback(this.currentValue);
    }

    return this.notificationHandler.subscribe(callback);
  }

  next(): Promise<T> {
    this.checkIfDestroyed();
    return new Promise((resolve) => {
      this.nextListeners.add(resolve.bind(this));
    });
  }

  waitUntil(data: T): Promise<T> {
    this.checkIfDestroyed();
    if (Comparator.isEqual(this.value, data)) {
      return Promise.resolve(data);
    } else {
      return new Promise((resolve) => {
        this.untilListeners.add({
          expected: data,
          callback: resolve.bind(this)
        });
      });
    }
  }

  destroy() {
    this.notificationHandler.destroy();
    this.nextListeners = new Set();
    this.untilListeners = new Set();
    this.destroyed = true;
  }

  private checkIfDestroyed() {
    if (this.destroyed) {
      throw new Error(`Variable: it is destroyed, cannot be subscribed!`);
    }
  }
}
