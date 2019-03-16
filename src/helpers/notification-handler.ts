
export class ActionSubscription {
  private unsubscribeCallback: () => void;

  constructor(unsubscribeCallback: () => void) {
    this.unsubscribeCallback = unsubscribeCallback;
  }

  unsubscribe() {
    this.unsubscribeCallback();
  }
}

export class NotificationHandler<T> {
  private listenersMap = new Map<number, (data: T) => any>();
  private nextAvailableSubscriptionId = 1;

  forEach(callback: (listenerCallbackFunction: (data: T) => any) => void) {
    this.listenersMap.forEach(callback);
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
