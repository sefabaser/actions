import { Comparator, JsonHelper } from 'helpers-lib';

import { Attachable, IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { Notifier } from '../_notifier/notifier';

export type VariableListenerCallbackFunction<T> = (data: T) => void;

export interface VariableOptions {
  readonly clone: boolean;
  readonly notifyOnChange: boolean;
}

class VariableNotifier<T> extends Notifier<T> {
  protected currentValue!: T;

  get notifier(): Notifier<T> {
    if (!this._notifier) {
      let notifier = new VariableNotifier<T>();
      notifier._listenersMapVar = this._listenersMapVar;
      notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
      notifier.subscribe = this.subscribe.bind(this);
      this._notifier = notifier;
    }
    return this._notifier;
  }

  subscribe(callback: VariableListenerCallbackFunction<T>): IAttachment {
    CallbackHelper._triggerCallback(this.currentValue, callback);
    return super.subscribe(callback);
  }

  toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscription = this.subscribe(resolve).attachToRoot();
      return () => subscription.destroy();
    });
  }

  toSingleEvent(): SingleEvent<T> {
    return SingleEvent.create<T>(resolve => {
      let subscription = this.subscribe(resolve).attachToRoot();
      return () => subscription.destroy();
    });
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): IAttachment {
    CallbackHelper._triggerCallback(this.currentValue, callback);
    return Attachable.getDestroyed();
  }
}

export class Variable<T> extends VariableNotifier<T> {
  get value(): T {
    return this.currentValue;
  }
  set value(value: T) {
    this.set(value);
  }

  constructor(value: T, partialOptions?: Partial<VariableOptions>) {
    super();
    this.currentValue = value;
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
    this.currentValue = data;
    this._triggerAll(data);
    return this;
  }

  private _notifyAlwaysCloneSet(data: T): this {
    this.currentValue = JsonHelper.deepCopy(data);
    this._triggerAll(data);
    return this;
  }

  private _notifyOnChangeNoCloneSet(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = data;

    if (!Comparator.isEqual(previousData, data)) {
      this._triggerAll(data);
    }

    return this;
  }

  private _notifyOnChangeCloneSet(data: T): this {
    let previousData = this.currentValue;
    this.currentValue = JsonHelper.deepCopy(data);

    if (!Comparator.isEqual(previousData, data)) {
      this._triggerAll(data);
    }

    return this;
  }
}
