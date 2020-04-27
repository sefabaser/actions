import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type ActionListenerCallbackFunction<T> = (data: T) => void;

export interface ActionOptions {
  clone?: boolean;
}

export class Action<T> {
  get listenerCount() {
    return this.notificationHandler.listenerCount;
  }

  private notificationHandler = new NotificationHandler<T>();
  private nextListeners = new Set<(data: T) => void>();
  private untilListeners = new Set<{ expected: T; callback: (data: T) => void }>();

  private clone: boolean;
  private destroyed = false;

  constructor(options: ActionOptions = {}) {
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.action.cloneBeforeNotification;
  }

  trigger(data: T): this {
    this.checkIfDestroyed();
    if (this.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    this.notificationHandler.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Notifier callback function error: ', e);
      }
    });

    this.nextListeners.forEach((callback) => callback(data));
    this.nextListeners = new Set();

    this.untilListeners.forEach((item) => {
      if (Comparator.isEqual(item.expected, data)) {
        item.callback(data);
        this.untilListeners.delete(item);
      }
    });

    return this;
  }

  subscribe(callback: ActionListenerCallbackFunction<T>): ActionSubscription {
    this.checkIfDestroyed();
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
    return new Promise((resolve) => {
      this.untilListeners.add({
        expected: data,
        callback: resolve.bind(this)
      });
    });
  }

  destroy() {
    this.notificationHandler.destroy();
    this.nextListeners = new Set();
    this.untilListeners = new Set();
    this.destroyed = true;
  }

  private checkIfDestroyed() {
    if (this.destroyed) {
      throw new Error(`Action: it is destroyed, cannot be subscribed!`);
    }
  }
}
