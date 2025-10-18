import { LightweightAttachable } from '../../attachable/lightweight-attachable';

export interface IDestroyable {
  destroy(): void;
  readonly destroyed: boolean;
}

export class ActionSubscription extends LightweightAttachable {
  static get destroyed(): ActionSubscription {
    let destroyedSubscription = new LightweightAttachable();
    destroyedSubscription.destroy();
    return destroyedSubscription as ActionSubscription;
  }

  /**
   * @param subscriptions the subscriptions to combine
   * @returns a new ActionSubscription. When destroyed, all given subscriptions will be destroyed as well.
   */
  static combine(subscriptions: ActionSubscription[]): ActionSubscription {
    return new ActionSubscription(() => {
      subscriptions.forEach(subscription => {
        subscription.destroy();
      });
    });
  }

  constructor(private destroyCallback: () => void) {
    super();
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyCallback();
      super.destroy();
    }
  }
}
