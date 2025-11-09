import { Attachable } from '../attachable/attachable';

export class ActionSubscription extends Attachable {
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
