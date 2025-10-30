import { BaseAttachable } from '../attachable/base-attachable';

export interface IDestroyable {
  destroy(): void;
  readonly destroyed: boolean;
}

export class ActionSubscription extends BaseAttachable {
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
