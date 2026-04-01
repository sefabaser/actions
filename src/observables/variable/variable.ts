import { Comparator, JsonHelper } from 'helpers-lib';

import { Attachable, type IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { Notifier } from '../_notifier/notifier';
import { type NotifierCallbackFunction } from '../_notifier/notifier-base';

export interface VariableOptions {
  readonly clone: boolean;
  readonly notifyOnChange: boolean;
}

class VariableNotifier<T> extends Notifier<T> {
  protected _state = {
    currentValue: undefined as T
  };

  override get notifier(): Notifier<T> {
    if (!this._notifier) {
      let notifier = new VariableNotifier<T>();
      notifier._listenersMapVar = this._listenersMap;
      notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
      notifier._state = this._state;
      this._notifier = notifier;
    }
    return this._notifier;
  }

  override subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    CallbackHelper._triggerCallback(this._state.currentValue, callback);
    return super.subscribe(callback);
  }

  override toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscription = this.subscribe(resolve).attachToRoot();
      return () => subscription.destroy();
    });
  }

  override toSingleEvent(): SingleEvent<T> {
    return SingleEvent.create<T>(resolve => {
      let subscription = this.subscribe(resolve).attachToRoot();
      return () => subscription.destroy();
    });
  }

  /** @internal */
  override _subscribeSingle(callback: (data: T) => void): Attachable {
    CallbackHelper._triggerCallback(this._state.currentValue, callback);
    return Attachable.getDestroyed();
  }
}

export class Variable<T> extends VariableNotifier<T> {
  get value(): T {
    return this._state.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  constructor(value: T, partialOptions?: Partial<VariableOptions>) {
    super();
    this._state.currentValue = value;
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

  // Dummy function, will be replaced with real one on constructor
  set(_: T): this {
    return this;
  }

  private _notifyAlwaysNoCloneSet(data: T): this {
    this._state.currentValue = data;
    this._triggerAll(data);
    return this;
  }

  private _notifyAlwaysCloneSet(data: T): this {
    this._state.currentValue = JsonHelper.deepCopy(data);
    this._triggerAll(data);
    return this;
  }

  private _notifyOnChangeNoCloneSet(data: T): this {
    let previousData = this._state.currentValue;
    this._state.currentValue = data;

    if (!Comparator.isEqual(previousData, data)) {
      this._triggerAll(data);
    }

    return this;
  }

  private _notifyOnChangeCloneSet(data: T): this {
    let previousData = this._state.currentValue;
    this._state.currentValue = JsonHelper.deepCopy(data);

    if (!Comparator.isEqual(previousData, data)) {
      this._triggerAll(data);
    }

    return this;
  }
}
