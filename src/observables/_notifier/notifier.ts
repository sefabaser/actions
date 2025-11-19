import { Attachable, IAttachment } from '../../attachable/attachable';
import { AsyncOperation } from '../../common';
import { CallbackHelper } from '../../helpers/callback.helper';
import { Sequence } from '../../stream/sequence/sequence';
import { ISequenceLinkContext } from '../../stream/sequence/sequence-executor';
import { SingleEvent } from '../../stream/single-event/single-event';

export class ActionSubscription extends Attachable {
  constructor(private _destroyCallback: () => void) {
    super();
  }

  destroy(): void {
    if (!this._destroyed) {
      this._destroyCallback();
      super.destroy();
    }
  }
}

export type NotifierCallbackFunction<T> = (data: T) => void;

export class Notifier<T> {
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

  private _listenersMap = new Map<number, NotifierCallbackFunction<T>>();
  private _nextAvailableSubscriptionID = 1;

  get listenerCount(): number {
    return this._listenersMap.size;
  }

  get notifier(): Notifier<T> {
    let wrapper = new Notifier<T>();
    wrapper._listenersMap = this._listenersMap;
    wrapper._nextAvailableSubscriptionID = this._nextAvailableSubscriptionID;
    wrapper.subscribe = this.subscribe.bind(this);
    return wrapper;
  }

  subscribe(callback: NotifierCallbackFunction<T>): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID++;
    this._listenersMap.set(subscriptionID, callback);

    return new ActionSubscription(() => {
      this._listenersMap.delete(subscriptionID);
    });
  }

  toSequence(): Sequence<T> {
    return Sequence.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID++;
      this._listenersMap.set(subscriptionID, resolve);
      return () => this._listenersMap.delete(subscriptionID);
    });
  }

  toSingleEvent(): SingleEvent<T> {
    return SingleEvent.create<T>(resolve => {
      let subscriptionID = this._nextAvailableSubscriptionID++;
      this._listenersMap.set(subscriptionID, event => {
        resolve(event);
        this._listenersMap.delete(subscriptionID);
      });
      return () => this._listenersMap.delete(subscriptionID);
    });
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

  /** @internal */
  _triggerAll(data: T): void {
    let listeners = [...this._listenersMap.values()];
    for (let i = 0; i < listeners.length; i++) {
      CallbackHelper._triggerCallback(data, listeners[i]);
    }
  }

  /** @internal */
  _subscribeSingle(callback: (data: T) => void): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID++;

    let subscription = new ActionSubscription(() => {
      this._listenersMap.delete(subscriptionID);
    });

    this._listenersMap.set(subscriptionID, data => {
      subscription.destroy();
      callback(data);
    });

    return subscription;
  }
}
