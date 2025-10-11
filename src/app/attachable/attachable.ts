import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassId } from './helpers/class-id';

export interface IAttachable {
  destroy(): void;
}

export class Attachable extends ClassId {
  readonly id: string = AttachmentTargetStore.registerAttachmentTarget(this);

  private attachedParent: Attachable | undefined;
  private attachments: IAttachable[] = [];

  private _attachIsCalled = false;
  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
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

  constructor() {
    super();
    setTimeout(() => {
      if (!this._destroyed && !this._attachIsCalled) {
        throw new Error(`Attachable: The object is not attached to anything!`);
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      this.attachedParent?.removeAttachment(this);
      this.attachedParent = undefined;
      AttachmentTargetStore.unregisterAttachmentTarget(this);

      let attachedEntities = [...this.attachments];
      attachedEntities.forEach(item => item.destroy());
      this.attachments = [];
      this._destroyed = true;
    }
  }

  attach(parent: Attachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
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
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    return this;
  }

  /** @internal */
  setAttachment(child: IAttachable): void {
    if (this._destroyed) {
      child.destroy();
    } else {
      this.attachments.push(child);
    }
  }

  /** @internal */
  removeAttachment(child: IAttachable): void {
    let index = this.attachments.indexOf(child);
    if (index >= 0) {
      this.attachments.splice(index, 1);
    }
  }
}
