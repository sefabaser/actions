import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { Notifier } from '../_notifier/notifier';

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

    this.triggerAll(data);
    return this;
  }
}
