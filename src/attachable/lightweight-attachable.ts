import { Comparator } from 'helpers-lib';

import { AttachmentTargetStore } from './helpers/attachment-target.store';

export interface IAttachable {
  destroyed: boolean;
  attachIsCalled: boolean;
  destroy(): void;
  attach(parent: LightweightAttachable | string): this;
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

  private _attachments: Set<IAttachable> | undefined;

  private _attachedParent: LightweightAttachable | undefined;
  /** @internal */
  get attachedParent(): LightweightAttachable | undefined {
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
        throw new Error(`Attachable: The object is not attached to anything!`);
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      if (this._attachedParent) {
        this._attachedParent.removeAttachment(this);
        this._attachedParent = undefined;
      }

      let attachedEntities = this._attachments;
      this._attachments = undefined;
      attachedEntities?.forEach(item => item.destroy());

      this._destroyed = true;
    }
  }

  attach(parent: LightweightAttachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      let parentEntity = Comparator.isString(parent) ? AttachmentTargetStore.findAttachmentTarget(parent) : parent;

      let currentParent: LightweightAttachable | undefined = parentEntity;
      while (currentParent) {
        if (currentParent === this) {
          throw new Error(`Circular attachment detected!`);
        }
        currentParent = currentParent.attachedParent;
      }

      parentEntity.setAttachment(this);
      this._attachedParent = parentEntity;
    }
    return this;
  }

  attachToRoot(): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    return this;
  }

  /** @internal */
  setAttachment(child: IAttachable): void {
    if (this.destroyed) {
      child.destroy();
    } else {
      if (!this._attachments) {
        this._attachments = new Set();
      }
      this._attachments.add(child);
    }
  }

  /** @internal */
  removeAttachment(child: IAttachable): void {
    this._attachments?.delete(child);
  }
}
