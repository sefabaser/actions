export class ActionSubscription {
  private unsubscribeCallback: () => void;

  constructor(unsubscribeCallback: () => void) {
    this.unsubscribeCallback = unsubscribeCallback;
  }

  unsubscribe() {
    this.unsubscribeCallback();
  }

  attach(parent: { setAttachment: (subscription: ActionSubscription) => void }) {
    parent.setAttachment(this);
    return this;
  }
}

export class NotificationHandler<T> {
  private listenersMap = new Map<number, (data: T) => any>();
  private nextAvailableSubscriptionId = 1;
  private destroyed = false;

  get listenerCount() {
    return this.listenersMap.size;
  }

  forEach(callback: (listenerCallbackFunction: (data: T) => any) => void) {
    this.listenersMap.forEach(callback);
  }

  subscribe(callback: (data: T) => any): ActionSubscription {
    if (!this.destroyed) {
      let subscriptionId = this.nextAvailableSubscriptionId;
      this.listenersMap.set(subscriptionId, callback);
      this.nextAvailableSubscriptionId++;

      let subscription = new ActionSubscription(() => {
        this.listenersMap.delete(subscriptionId);
      });

      return subscription;
    } else {
      throw new Error(`Notification Handler: it is destroyed, cannot be subscribed!`);
    }
  }

  destroy() {
    this.listenersMap = new Map();
    this.destroyed = true;
  }
}
