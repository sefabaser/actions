import { Attachable } from '../attachable/attachable';

export interface IDestroyable {
  destroy(): void;
  readonly destroyed: boolean;
}

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
