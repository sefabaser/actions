export class ActionSubscription {
  private unsubscribeCallback: () => void;

  constructor(unsubscribeCallback: () => void) {
    this.unsubscribeCallback = unsubscribeCallback;
  }

  unsubscribe(): void {
    this.unsubscribeCallback();
  }

  attach(parent: { setAttachment: (subscription: ActionSubscription) => void }): ActionSubscription {
    parent.setAttachment(this);
    return this;
  }
}

export class NotificationHandler<T> {
  private listenersMap = new Map<number, (data: T) => any>();
  private nextAvailableSubscriptionId = 1;

  get listenerCount(): number {
    return this.listenersMap.size;
  }

  forEach(callback: (listenerCallbackFunction: (data: T) => any) => void): NotificationHandler<T> {
    this.listenersMap.forEach(callback);
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
}
