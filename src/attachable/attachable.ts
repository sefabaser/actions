import { AttachmentTargetStore } from './helpers/attachment-target.store';

export interface IAttachment {
  destroyed: boolean;
  _attachIsCalled: boolean;
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
    destroyedSubscription._destroyedVar = true;
    return destroyedSubscription;
  }

  private _attachments: Set<IAttachment> | undefined;

  private _attachedParentVar: Attachable | undefined;
  /** @internal */
  get _attachedParent(): Attachable | undefined {
    return this._attachedParentVar;
  }

  private _destroyedVar = false;
  get destroyed(): boolean {
    return this._destroyedVar;
  }

  /** @internal */
  _attachIsCalledVar = false;
  get _attachIsCalled(): boolean {
    return this._attachIsCalledVar;
  }

  constructor(protected destroyIfNotAttached = false) {
    queueMicrotask(() => {
      if (!this._attachIsCalledVar && !this._destroyedVar) {
        if (this.destroyIfNotAttached) {
          this.destroy();
        } else {
          throw new Error(`Attachable: The object is not attached to anything!`);
        }
      }

      let currentParent: Attachable | undefined = this._attachedParent;
      while (currentParent) {
        if (currentParent === this) {
          throw new Error(`Circular attachment detected!`);
        }
        currentParent = currentParent._attachedParent;
      }
    });
  }

  destroy(): void {
    if (!this._destroyedVar) {
      if (this._attachedParentVar) {
        this._attachedParentVar._removeAttachment(this);
        this._attachedParentVar = undefined;
      }

      let attachedEntities = this._attachments;
      this._attachments = undefined;
      if (attachedEntities) {
        for (let entity of attachedEntities) {
          entity.destroy();
        }
      }

      this._destroyedVar = true;
    }
  }

  attach(parent: Attachable): this {
    if (this._attachIsCalledVar) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalledVar = true;
    if (!this._destroyedVar) {
      this._attachedParentVar = parent;
      this._attachedParentVar._setAttachment(this);
    }
    return this;
  }

  attachByID(id: number): this {
    if (this._attachIsCalledVar) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalledVar = true;
    if (!this._destroyedVar) {
      this._attachedParentVar = AttachmentTargetStore._findAttachmentTarget(id);
      this._attachedParentVar._setAttachment(this);
    }
    return this;
  }

  attachToRoot(): this {
    if (this._attachIsCalledVar) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalledVar = true;
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
