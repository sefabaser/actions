import { LightweightAttachable } from '../attachable/lightweight-attachable';

export interface IDestroyable {
  destroy(): void;
  readonly destroyed: boolean;
}

export class ActionSubscription extends LightweightAttachable {
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
