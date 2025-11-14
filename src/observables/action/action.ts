import { JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { Notifier } from '../_notifier/notifier';

export interface ActionOptions {
  readonly clone: boolean;
}

export class Action<T = void> extends Notifier<T> {
  constructor(partialOptions?: Partial<ActionOptions>) {
    super();
    let options = {
      clone: ActionLibDefaults.action.cloneBeforeNotification,
      ...partialOptions
    };

    this.trigger = options.clone ? this.cloneTrigger.bind(this) : this.noCloneTrigger.bind(this);
  }

  trigger(_: T): this {
    return this;
  }

  private noCloneTrigger(data: T): this {
    this.triggerAll(data);
    return this;
  }

  private cloneTrigger(data: T): this {
    data = JsonHelper.deepCopy(data);
    this.triggerAll(data);
    return this;
  }
}
