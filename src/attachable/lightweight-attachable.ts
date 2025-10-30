import { Attachable } from './attachable';
import { AttachmentTargetStore } from './helpers/attachment-target.store';

export interface IAttachable {
  destroyed: boolean;
  attachIsCalled: boolean;
  destroy(): void;
  attach(parent: Attachable | string): this;
  attachToRoot(): this;
}

export class LightweightAttachable implements IAttachable {
  /**
   * @returns IAttachable that is already destroyed
   */
  static getDestroyed(): IAttachable {
    let destroyedSubscription = new LightweightAttachable();
    destroyedSubscription.destroy();
    return destroyedSubscription;
  }

  /** @internal */
  static attach(parent: Attachable | string, child: IAttachable): Attachable {
    let parentEntity = AttachmentTargetStore.findAttachmentTarget(parent);

    let currentParent: Attachable | undefined = parentEntity;
    while (currentParent) {
      if (currentParent === child) {
        throw new Error(`Circular attachment detected!`);
      }
      currentParent = currentParent.attachedParent;
    }

    parentEntity.setAttachment(child);
    return parentEntity;
  }

  private _attachedParent: Attachable | undefined;
  /** @internal */
  get attachedParent(): Attachable | undefined {
    return this._attachedParent;
  }

  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  private _attachIsCalled = false;
  /** @internal */
  get attachIsCalled(): boolean {
    return this._attachIsCalled;
  }

  constructor() {
    setTimeout(() => {
      if (!this._attachIsCalled && !this._destroyed) {
        throw new Error(`LightweightAttachable: The object is not attached to anything!`);
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      if (this._attachedParent) {
        this._attachedParent.removeAttachment(this);
        this._attachedParent = undefined;
      }
      this._destroyed = true;
    }
  }

  attach(parent: Attachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`LightweightAttachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      let parentEntity = LightweightAttachable.attach(parent, this);
      this._attachedParent = parentEntity;
    }
    return this;
  }

  attachToRoot(): this {
    if (this._attachIsCalled) {
      throw new Error(`LightweightAttachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    return this;
  }
}
