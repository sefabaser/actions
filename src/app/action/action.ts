import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type ActionListenerCallbackFunction<T> = (data: T) => void;

export interface ActionOptions {
  clone?: boolean;
  persistent?: boolean;
}

export class Action<T> {
  get listenerCount(): number {
    return this.notificationHandler.listenerCount;
  }

  private notificationHandler = new NotificationHandler<T>();
  private nextListeners = new Set<(data: T) => void>();
  private untilListeners = new Set<{ expected: T; callback: (data: T) => void }>();

  private clone: boolean;
  private triggered = false;
  private currentValue?: T;

  constructor(private options: ActionOptions = {}) {
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.action.cloneBeforeNotification;
  }

  trigger(data: T): this {
    if (this.options.persistent) {
      this.currentValue = this.clone ? JsonHelper.deepCopy(data) : data;
      this.triggered = true;
    }

    if (this.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    this.notificationHandler.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    });

    this.nextListeners.forEach(callback => callback(data));
    this.nextListeners = new Set();

    this.untilListeners.forEach(item => {
      if (Comparator.isEqual(item.expected, data)) {
        item.callback(data);
        this.untilListeners.delete(item);
      }
    });

    return this;
  }

  subscribe(callback: ActionListenerCallbackFunction<T>): ActionSubscription {
    if (this.options.persistent && this.triggered) {
      callback(<T>this.currentValue);
    }
    return this.notificationHandler.subscribe(callback);
  }

  async next(): Promise<T> {
    return new Promise(resolve => {
      this.nextListeners.add(resolve.bind(this));
    });
  }

  async waitUntil(data: T): Promise<T> {
    return new Promise(resolve => {
      this.untilListeners.add({
        expected: data,
        callback: resolve.bind(this)
      });
    });
  }
}
