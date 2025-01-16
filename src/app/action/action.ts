import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';

export type ActionListenerCallbackFunction<T> = (data: T) => void;

export interface ActionOptions {
  clone?: boolean;
}

export class Action<T> {
  get listenerCount(): number {
    return this.notificationHandler.listenerCount;
  }

  private notificationHandler = new NotificationHandler<T>();
  private nextListeners = new Set<(data: T) => void>();
  private untilListeners = new Set<{ expected: T; callback: (data: T) => void }>();

  private clone: boolean;

  constructor(private options: ActionOptions = {}) {
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.action.cloneBeforeNotification;
  }

  trigger(data: T): this {
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

    return this;
  }

  subscribe(callback: ActionListenerCallbackFunction<T>): ActionSubscription {
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
    this.untilListeners.add({ expected: data, callback: callback });
  }

  async waitUntil(data: T): Promise<T> {
    return new Promise(resolve => {
      this.waitUntilCallback(data, resolve);
    });
  }
}
