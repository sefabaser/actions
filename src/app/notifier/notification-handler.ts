import { LightweightAttachable } from '../attachable/lightweight-attachable';

export class ActionSubscription extends LightweightAttachable {
  private static destroyedSubscription: ActionSubscription;

  static get destroyed(): ActionSubscription {
    if (!this.destroyedSubscription) {
      this.destroyedSubscription = new ActionSubscription(() => {});
      this.destroyedSubscription.destroy();
    }
    return this.destroyedSubscription;
  }

  /**
   * @param subscriptions the subscriptions to combine
   * @returns a new ActionSubscription that combines the given subscriptions, when unsubscribed, all given subscriptions will be unsubscribed
   */
  static combine(subscriptions: ActionSubscription[]): ActionSubscription {
    return new ActionSubscription(() => {
      subscriptions.forEach(subscription => {
        subscription.destroy();
      });
    });
  }

  constructor(private unsubscribeCallback: () => void) {
    super();
  }

  destroy(): void {
    if (!this.destroyed) {
      this.unsubscribeCallback();
      super.destroy();
    }
  }
}

export class NotificationHandler<T> {
  private listenersMap = new Map<number, (data: T) => any>();
  private nextAvailableSubscriptionId = 1;

  get listenerCount(): number {
    return this.listenersMap.size;
  }

  forEach(callback: (listenerCallbackFunction: (data: T) => any) => void): NotificationHandler<T> {
    let newMap = new Map<number, (data: T) => any>(this.listenersMap);
    newMap.forEach(data => {
      try {
        callback(data);
      } catch (e) {
        console.error('Observable map callback function error: ', e);
      }
    });
    return this;
  }

  subscribe(callback: (data: T) => any): ActionSubscription {
    let subscriptionId = this.nextAvailableSubscriptionId;
    this.listenersMap.set(subscriptionId, callback);
    this.nextAvailableSubscriptionId++;

    let subscription = new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });

    return subscription;
  }

  /** @internal */
  getAllListeners(): ((data: T) => any)[] {
    return [...this.listenersMap.values()];
  }
}
