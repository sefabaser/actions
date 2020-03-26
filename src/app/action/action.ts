import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type ActionListenerCallbackFunction<T> = (data: T) => void;

export interface ActionOptions {
  clone?: boolean;
}

export class Action<T> {
  private notificationHandler = new NotificationHandler<T>();
  private clone: boolean;

  constructor(options: ActionOptions = {}) {
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.action.cloneBeforeNotification;
  }

  trigger(data: T): void {
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
  }

  subscribe(callback: ActionListenerCallbackFunction<T>): ActionSubscription {
    return this.notificationHandler.subscribe(callback);
  }
}
