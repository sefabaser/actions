import { NotificationHelper } from '../../helpers/notification.helper';
import { LightweightAttachable } from '../attachable/lightweight-attachable';

export type NotifierCallbackFunction<T> = (data: T) => void;

export class ActionSubscription extends LightweightAttachable {
  static get destroyed(): ActionSubscription {
    let destroyedSubscription = new LightweightAttachable();
    destroyedSubscription.destroy();
    return destroyedSubscription as ActionSubscription;
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
  private listenersMap = new Map<number, NotifierCallbackFunction<T>>();
  private nextAvailableSubscriptionId = 1;

  get listenerCount(): number {
    return this.listenersMap.size;
  }

  forEach(callback: (listenerCallbackFunction: NotifierCallbackFunction<T>) => void): NotificationHandler<T> {
    let newMap = new Map<number, NotifierCallbackFunction<T>>(this.listenersMap);
    newMap.forEach(data => NotificationHelper.notify(data, callback));
    return this;
  }

  subscribe(callback: NotifierCallbackFunction<T>): ActionSubscription {
    let subscriptionId = this.nextAvailableSubscriptionId;
    this.listenersMap.set(subscriptionId, callback);
    this.nextAvailableSubscriptionId++;

    let subscription = new ActionSubscription(() => {
      this.listenersMap.delete(subscriptionId);
    });

    return subscription;
  }

  /** @internal */
  get listeners(): NotifierCallbackFunction<T>[] {
    return [...this.listenersMap.values()];
  }
}
