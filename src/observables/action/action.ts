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

    this.trigger = options.clone ? this._cloneTrigger.bind(this) : this._noCloneTrigger.bind(this);
  }

  // Dummy function, will be replaced with real one on constructor
  trigger(_: T): this {
    return this;
  }

  private _noCloneTrigger(data: T): this {
    this._triggerAll(data);
    return this;
  }

  private _cloneTrigger(data: T): this {
    data = JsonHelper.deepCopy(data);
    this._triggerAll(data);
    return this;
  }
}
