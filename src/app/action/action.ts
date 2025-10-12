import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { Notifier } from '../notifier/notifier';

export type ActionListenerCallbackFunction<T> = (data: T) => void;

export interface ActionOptions {
  readonly clone: boolean;
}

export class Action<T> extends Notifier<T> {
  private options: ActionOptions;

  constructor(options?: Partial<ActionOptions>) {
    super();
    this.options = {
      clone: ActionLibDefaults.action.cloneBeforeNotification,
      ...options
    };
  }

  trigger(data: T): this {
    if (this.options.clone && Comparator.isObject(data)) {
      data = JsonHelper.deepCopy(data);
    }

    this.notificationHandler.forEach(callback => this.notify(data, callback));
    return this;
  }
}
