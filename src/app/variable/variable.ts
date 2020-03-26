import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  clone?: boolean;
  notifyOnChange?: boolean;
}

export class Variable<T> {
  get currentValue() {
    return this.previousData;
  }

  private notificationHandler = new NotificationHandler<T>();

  private previousData!: T;
  private firstTriggerHappened = false;
  private notifyOnlyOnChange: boolean;
  private clone: boolean;

  constructor(options: VariableOptions = {}) {
    this.notifyOnlyOnChange = options.notifyOnChange !== undefined ? options.notifyOnChange : ActionLibDefaults.variable.notifyOnChange;
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.variable.cloneBeforeNotification;
  }

  trigger(data: T): void {
    if (this.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    let previousData = this.previousData;
    this.previousData = this.clone ? JsonHelper.deepCopy(data) : data;
    if (!this.notifyOnlyOnChange || !Comparator.isEqual(previousData, data)) {
      this.notificationHandler.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
      });
    }

    this.firstTriggerHappened = true;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>): ActionSubscription {
    if (this.firstTriggerHappened) {
      callback(this.previousData);
    }

    return this.notificationHandler.subscribe(callback);
  }
}
