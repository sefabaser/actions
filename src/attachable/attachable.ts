import { AttachmentTargetStore } from './helpers/attachment-target.store';

export interface IAttachment {
  destroyed: boolean;
  attachIsCalled: boolean;
  destroy(): void;
  attach(parent: Attachable): this;
  attachByID(parent: number): this;
  attachToRoot(): this;
}

export class Attachable implements IAttachment {
  /**
   * @returns Attachable that is already destroyed
   */
  static getDestroyed(): IAttachment {
    let destroyedSubscription = new Attachable();
    destroyedSubscription._destroyed = true;
    return destroyedSubscription;
  }

  private _attachments: Set<IAttachment> | undefined;

  private _attachedParent: Attachable | undefined;
  /** @internal */
  get attachedParent(): Attachable | undefined {
    return this._attachedParent;
  }

  /** @internal */
  _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  _attachIsCalled = false;
  get attachIsCalled(): boolean {
    return this._attachIsCalled;
  }

  /** @internal */
  protected _destroyIfNotAttached?: true;

  constructor() {
    // NOTE: this can be removed in release mode, only if "destroy if not attached" can be done differently
    Promise.resolve().then(() => {
      if (!this._attachIsCalled && !this._destroyed) {
        if (this._destroyIfNotAttached) {
          this.destroy();
        } else {
          throw new Error(`Attachable: The object is not attached to anything!`);
        }
      }

      let currentParent: Attachable | undefined = this.attachedParent;
      while (currentParent) {
        if (currentParent === this) {
          throw new Error(`Circular attachment detected!`);
        }
        currentParent = currentParent.attachedParent;
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      if (this._attachedParent) {
        this._attachedParent._removeAttachment(this);
        this._attachedParent = undefined;
      }

      let attachedEntities = this._attachments;
      this._attachments = undefined;
      if (attachedEntities) {
        for (let entity of attachedEntities) {
          entity.destroy();
        }
      }

      this._destroyed = true;
    }
  }

  attach(parent: Attachable): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      this._attachedParent = parent;
      this._attachedParent._setAttachment(this);
    }
    return this;
  }

  attachByID(id: number): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      this._attachedParent = AttachmentTargetStore._findAttachmentTarget(id);
      this._attachedParent._setAttachment(this);
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
  _setAttachment(child: IAttachment): void {
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
  _removeAttachment(child: IAttachment): void {
    this._attachments?.delete(child);
  }
}
