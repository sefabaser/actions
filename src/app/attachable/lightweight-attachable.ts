import { Attachable, IAttachable } from './attachable';

export class LightweightAttachable implements IAttachable {
  private attachedParent: Attachable | undefined;

  private _attachIsCalled = false;
  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  constructor() {
    setTimeout(() => {
      if (!this._destroyed && !this._attachIsCalled) {
        throw new Error(`LightweightAttachable: The object is not attached to anything!`);
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      this.attachedParent?.removeAttachment(this);
      this.attachedParent = undefined;
      this._destroyed = true;
    }
  }

  attach(parent: Attachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`LightweightAttachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      let parentEntity = Attachable.attach(parent, this);
      this.attachedParent = parentEntity;
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
