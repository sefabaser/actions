import type { Attachable } from '../../attachable/attachable';
import { type AsyncOperation } from '../../common';
import { SingleEvent } from '../../stream/single-event/single-event';
import { type ISingleEventContext } from '../../stream/single-event/single-event-executor';
import { NotifierBase } from './notifier-base';

export class SingleNotifier<T = void> extends NotifierBase<T> {
  static fromSingleEvent<S>(sequence: SingleEvent<S>): {
    attach: (parent: Attachable) => SingleNotifier<S>;
    attachByID: (parent: number) => SingleNotifier<S>;
    attachToRoot: () => SingleNotifier<S>;
  } {
    if (sequence.attachIsCalled) {
      throw new Error('Attached sequences cannot be converted to notifier!');
    }

    let notifier = new SingleNotifier<S>();
    sequence._subscribeSingle(data => notifier._triggerAll(data));
    return {
      attach: (parent: Attachable) => {
        sequence.attach(parent);
        return notifier;
      },
      attachByID: (id: number) => {
        sequence.attachByID(id);
        return notifier;
      },
      attachToRoot: () => {
        sequence.attachToRoot();
        return notifier;
      }
    };
  }

  protected _notifier: SingleNotifier<T> | undefined;
  get notifier(): SingleNotifier<T> {
    if (!this._notifier) {
      this._notifier = new SingleNotifier<T>();
      this._notifier._listenersMapVar = this._listenersMap;
      this._notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
    }
    return this._notifier;
  }

  map<K>(callback: (data: T, context: ISingleEventContext) => K): SingleEvent<K> {
    return this.toSingleEvent().map(callback);
  }

  wait(duration?: number): SingleEvent<T> {
    return this.toSingleEvent().wait(duration);
  }

  /**
   * **Execution**: The incoming package **executes directly** and **directly resolves** after async operation responds.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @R ----------------------------A-------------------
   */
  asyncMap<K>(callback: (data: T, context: ISingleEventContext) => AsyncOperation<K> | K): SingleEvent<K> {
    return this.toSingleEvent().asyncMap(callback);
  }
}
