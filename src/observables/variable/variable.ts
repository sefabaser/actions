import { Comparator, JsonHelper } from 'helpers-lib';

import { Attachable, IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Notifier } from '../_notifier/notifier';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  readonly clone: boolean;
  readonly notifyOnChange: boolean;
}

export class Variable<T> extends Notifier<T> {
  get value(): T {
    return this._currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  private _currentValue!: T;

  constructor(value: T, partialOptions?: Partial<VariableOptions>) {
    super();
    this._currentValue = value;
    let options = {
      notifyOnChange: ActionLibDefaults.variable.notifyOnChange,
      clone: ActionLibDefaults.variable.cloneBeforeNotification,
      ...partialOptions
    };

    if (options.notifyOnChange) {
      this.set = options.clone ? this._notifyOnChangeCloneSet.bind(this) : this._notifyOnChangeNoCloneSet.bind(this);
    } else {
      this.set = options.clone ? this._notifyAlwaysCloneSet.bind(this) : this._notifyAlwaysNoCloneSet.bind(this);
    }
  }

  set(_: T): this {
    return this;
  }

  private _notifyAlwaysNoCloneSet(data: T): this {
    this._currentValue = data;
    this.triggerAll(data);
    return this;
  }

  private _notifyAlwaysCloneSet(data: T): this {
    this._currentValue = JsonHelper.deepCopy(data);
    this.triggerAll(data);
    return this;
  }

  private _notifyOnChangeNoCloneSet(data: T): this {
    let previousData = this._currentValue;
    this._currentValue = data;

    if (!Comparator.isEqual(previousData, data)) {
      this.triggerAll(data);
    }

    return this;
  }

  private _notifyOnChangeCloneSet(data: T): this {
    let previousData = this._currentValue;
    this._currentValue = JsonHelper.deepCopy(data);

    if (!Comparator.isEqual(previousData, data)) {
      this.triggerAll(data);
    }

    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>): IAttachment {
    CallbackHelper.triggerCallback(this._currentValue, callback);
    return super.subscribe(callback);
  }

  /** @internal */
  readSingle(callback: (data: T) => void): IAttachment {
    CallbackHelper.triggerCallback(this._currentValue, callback);
    return Attachable.getDestroyed();
  }
}
