import { JsonHelper, Comparator } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../helpers/notification-handler';

export type NotifierListenerCallbackFunction<T> = (data?: T) => void;

export interface NotifierOptions {
  notifyOnlyOnChange?: boolean;
  persistent?: boolean;
  doNotClone?: boolean;
}

export class Notifier<T> {
  // TODO: unit tests, place this also to other actions
  get currentValue() {
    return this.options.doNotClone ? this.previousData : JsonHelper.deepCopy(this.previousData);
  }

  private notificationHandler = new NotificationHandler<T>();

  private options: NotifierOptions;
  private firstTriggerHappened = false;
  private previousData!: T;

  constructor(options: NotifierOptions = {}) {
    this.options = options;
  }

  trigger(data: T): void {
    if (Comparator.isObject(data) && !this.options.doNotClone) {
      data = JsonHelper.deepCopy(data);
    }

    if (!this.options.notifyOnlyOnChange || !Comparator.isEqual(this.previousData, data)) {
      this.notificationHandler.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Notifier callback function error: ', e);
        }
      });
    }

    this.previousData = data;
    this.firstTriggerHappened = true;
  }

  subscribe(callback: NotifierListenerCallbackFunction<T>): ActionSubscription {
    if (this.options.persistent && this.firstTriggerHappened) {
      if (this.previousData) {
        callback(this.previousData);
      }
    }

    return this.notificationHandler.subscribe(callback);
  }
}
