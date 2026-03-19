import { JsonHelper } from 'helpers-lib';

import { Attachable, type IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { type NotifierCallbackFunction } from '../_notifier/notifier-base';
import { SingleNotifier } from '../_notifier/single-notifier';

export interface SingleActionOptions {
  readonly clone: boolean;
}

class SingleActionNotifier<T = void> extends SingleNotifier<T> {
  protected _state = {
    resolved: false as boolean,
    resolvedValue: undefined as T | undefined
  };

  protected _notifier: SingleNotifier<T> | undefined;
  get notifier(): SingleNotifier<T> {
    if (!this._notifier) {
      let notifier = new SingleActionNotifier<T>();
      notifier._listenersMapVar = this._listenersMap;
      notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
      notifier._state = this._state;
      this._notifier = notifier;
    }
    return this._notifier;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    if (this._state.resolved) {
      CallbackHelper._triggerCallback(this._state.resolvedValue!, callback);
      return Attachable.getDestroyed();
    } else {
      return super.subscribe(callback);
    }
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
  _subscribeSingle(callback: (data: T) => void): Attachable {
    if (this._state.resolved) {
      CallbackHelper._triggerCallback(this._state.resolvedValue!, callback);
      return Attachable.getDestroyed();
    } else {
      return super._subscribeSingle(callback);
    }
  }
}

/**
 * Can be resolved only once, multiple resolutions will be ignored.
 * If resolved, the new subscribers will be notified directly with the resolved value.
 */
export class SingleAction<T = void> extends SingleActionNotifier<T> {
  get resolved(): boolean {
    return this._state.resolved === true;
  }

  get value(): T | undefined {
    return this._state.resolvedValue;
  }

  constructor(partialOptions?: Partial<SingleActionOptions>) {
    super();
    let options = {
      notifyOnChange: ActionLibDefaults.variable.notifyOnChange,
      clone: ActionLibDefaults.variable.cloneBeforeNotification,
      ...partialOptions
    };

    this.resolve = options.clone ? this._notifyClone.bind(this) : this._notifyNoClone.bind(this);
  }

  // Dummy function, will be replaced with real one on constructor
  resolve(_: T): this {
    return this;
  }

  private _notifyNoClone(data: T): this {
    if (!this._state.resolved) {
      this._state.resolved = true;
      this._state.resolvedValue = data;
      this._triggerAll(data);
    }
    return this;
  }

  private _notifyClone(data: T): this {
    if (!this._state.resolved) {
      this._state.resolved = true;
      this._state.resolvedValue = JsonHelper.deepCopy(data);
      this._triggerAll(this._state.resolvedValue);
    }
    return this;
  }
}
