import type { Attachable } from '../../attachable/attachable';
import { type AsyncOperation } from '../../common';
import { Sequence } from '../../stream/sequence/sequence';
import { type ISequenceLinkContext } from '../../stream/sequence/sequence-executor';
import { NotifierBase } from './notifier-base';

export class Notifier<T = void> extends NotifierBase<T> {
  static fromSequence<S>(sequence: Sequence<S>): {
    attach: (parent: Attachable) => Notifier<S>;
    attachByID: (parent: number) => Notifier<S>;
    attachToRoot: () => Notifier<S>;
  } {
    if (sequence.attachIsCalled) {
      throw new Error('Attached sequences cannot be converted to notifier!');
    }

    let notifier = new Notifier<S>();
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

  protected _notifier: Notifier<T> | undefined;
  get notifier(): Notifier<T> {
    if (!this._notifier) {
      this._notifier = new Notifier<T>();
      this._notifier._listenersMapVar = this._listenersMap;
      this._notifier._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
    }
    return this._notifier;
  }

  map<K>(callback: (data: T, context: ISequenceLinkContext) => K): Sequence<K> {
    return this.toSequence().map(callback);
  }

  filter(callback: (data: T, previousValue: T | undefined) => boolean): Sequence<T> {
    return this.toSequence().filter(callback);
  }

  take(count: number): Sequence<T> {
    return this.toSequence().take(count);
  }

  skip(count: number): Sequence<T> {
    return this.toSequence().skip(count);
  }

  wait(duration?: number): Sequence<T> {
    return this.toSequence().wait(duration);
  }

  /**
   * Drops the previous package that is still waiting for the timeout.
   */
  debounce(duration?: number): Sequence<T> {
    return this.toSequence().debounce(duration);
  }

  asyncTap(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<unknown> | void): Sequence<T> {
    return this.toSequence().asyncTap(callback);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting. Which can break package order.
   *
   * **Sample Use Case**: Showing an animation for each package, regardless of what other packages are doing.
   *
   * - `✅ Never Drops Packages`
   * - `❌ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I———>✓----------------------------
   * @C --------------I——>✓-------------------------
   * @R -------------------B-C-----A-------------------
   */
  asyncMapDirect<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    return this.toSequence().asyncMapDirect(callback);
  }

  /**
   * **Execution**: Each incoming package **executes directly** but **waits before resolve** the package before them to resolve to keep the order.
   *
   * **Sample Use Case**: Using async translation service, before storing ordered event history.
   *
   * **⚠️Careful**: Can create a bottleneck! If an async operation never resolves, all packages behind will be stuck.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I———I- - - - - - >✓-----------------
   * @C --------------I——I- - - - - >✓----------------
   * @R ----------------------------ABC----------------
   */
  asyncMapOrdered<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    return this.toSequence().asyncMapOrdered(callback);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * The latest value is important, the packages that lacks behind are dropped.
   *
   * **Sample Use Case**: Converting a state with translating some keys in it with an async “translate” function.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `✅ Parallel Execution`
   *
   * @A ---I——————Ix----------------------------
   * @B ---------I———>✓----------------------------
   * @C --------------I——>✓-------------------------
   * @R -------------------B-C-------------------------
   */
  asyncMapLatest<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    return this.toSequence().asyncMapLatest(callback);
  }

  /**
   * **Execution**: Each incoming package **executes sequentially** and **resolves directly** without waiting.
   *
   * **Sample Use Case**: Payment operation, one can be processed if the previous one ends in success.
   *
   * **⚠️Careful**: Can create a bottleneck! The feeding speed should not exceed the digestion speed.
   *
   * - `✅ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------I- - - - - - - - - - - I———>✓---------
   * @C --------------I- - - - - - - - - - - - - - I——>✓-
   * @R ----------------------------A--------B------C--
   */
  asyncMapQueue<K>(
    callback: (data: T, previousResult: K | undefined, context: ISequenceLinkContext) => AsyncOperation<K> | K
  ): Sequence<K> {
    return this.toSequence().asyncMapQueue(callback);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * If a new package comes while another is in progress, the one in progress will be dropped.
   *
   * **Sample Use Case**: Auto completion with async operation. If value changes the old operation becomes invalid.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I——Ix--------------------------------------
   * @B ---------I——Ix--------------------------------
   * @C ---------------I——>✓------------------------
   * @R ----------------------C-------------------------
   */
  asyncMapDropOngoing<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    return this.toSequence().asyncMapDropOngoing(callback);
  }

  /**
   * **Execution**: Each incoming package **executes directly** and **resolves directly** without waiting.
   * If a package is in progress, the newcomers will be dropped.
   *
   * **Sample Use Case**: Refresh button. While in progress, the new requests gets ignored.
   *
   * - `❌ Never Drops Packages`
   * - `✅ Respects Package Order`
   * - `❌ Parallel Execution`
   *
   * @A ---I—————————>✓-------------------
   * @B ---------x--------------------------------------
   * @C ---------------x--------------------------------
   * @R ---------------------------A--------------------
   */
  asyncMapDropIncoming<K>(callback: (data: T, context: ISequenceLinkContext) => AsyncOperation<K> | K): Sequence<K> {
    return this.toSequence().asyncMapDropIncoming(callback);
  }
}
