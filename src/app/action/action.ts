import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { DestroyablePromise } from '../destroyable-promise/destroyable-promise';

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

  constructor(options: ActionOptions = {}) {
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
      this.nextListeners.add(resolve);
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

  /** @internal */
  getAllListeners(): ((data: T) => any)[] {
    return this.notificationHandler.getAllListeners();
  }
}
