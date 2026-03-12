import { AsyncOperation } from '../../common';
import { SingleEvent } from '../../stream/single-event/single-event';
import { ISingleEventContext } from '../../stream/single-event/single-event-executor';
import { NotifierBase } from './notifier-base';

export class SingleNotifier<T = void> extends NotifierBase<T> {
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
