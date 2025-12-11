import { JsonHelper } from 'helpers-lib';

import { Attachable, IAttachment } from '../../attachable/attachable';
import { ActionLibDefaults } from '../../config';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { Notifier, NotifierCallbackFunction } from '../_notifier/notifier';

export interface SingleActionOptions {
  readonly clone: boolean;
}

class SingleActionNotifier<T = void> extends Notifier<T> {
  protected _resolved: true | undefined;
  protected _resolvedValue: T | undefined;

  get notifier(): Notifier<T> {
    if (!this._notifier) {
      let notifier = new SingleActionNotifier<T>();
      notifier._listenersMapVar = this._listenersMapVar;
      notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
      notifier.subscribe = this.subscribe.bind(this);
      this._notifier = notifier;
    }
    return this._notifier;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    if (this._resolved) {
      CallbackHelper._triggerCallback(this._resolvedValue, callback);
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
  _subscribeSingle(callback: (data: T) => void): IAttachment {
    if (this._resolved) {
      CallbackHelper._triggerCallback(this._resolvedValue, callback);
      return Attachable.getDestroyed();
    } else {
      return super._subscribeSingle(callback);
    }
  }
}

export class SingleAction<T = void> extends SingleActionNotifier<T> {
  get resolved(): boolean {
    return this._resolved === true;
  }

  get value(): T | undefined {
    return this._resolvedValue;
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
    if (!this._resolved) {
      this._resolved = true;
      this._resolvedValue = data;
      this._triggerAll(data);
    }
    return this;
  }

  private _notifyClone(data: T): this {
    if (!this._resolved) {
      this._resolved = true;
      this._resolvedValue = JsonHelper.deepCopy(data);
      this._triggerAll(this._resolvedValue);
    }
    return this;
  }
}
