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

  private clone: boolean;

  private notificationHandler = new NotificationHandler<T>();

  private _nextListeners?: Set<(data: T) => void>;
  private get nextListeners(): Set<(data: T) => void> {
    if (!this._nextListeners) {
      this._nextListeners = new Set();
    }
    return this._nextListeners;
  }

  private _untilListeners?: Set<{ expected: T; callback: (data: T) => void }>;
  private get untilListeners(): Set<{ expected: T; callback: (data: T) => void }> {
    if (!this._untilListeners) {
      this._untilListeners = new Set();
    }
    return this._untilListeners;
  }

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

    if (this._nextListeners) {
      this.nextListeners.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
      });
      this._nextListeners = undefined;
    }

    if (this._untilListeners) {
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

      if (this.untilListeners.size === 0) {
        this._untilListeners = undefined;
      }
    }

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
}
