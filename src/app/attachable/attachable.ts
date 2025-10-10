import { Comparator } from 'helpers-lib';

import { AttachableStore } from './attachable.store';
import { ClassId } from './class-id';

export class Attachable extends ClassId {
  readonly id: string = AttachableStore.registerAttachmentTarget(this);

  private attachedParent: Attachable | undefined;
  private attachments: Attachable[] = [];

  private _attachIsCalled = false;
  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
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
      AttachableStore.unregisterAttachmentTarget(this);

      let attachedEntities = [...this.attachments];
      attachedEntities.forEach(item => this.destroyAttachment(item));
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
      let parentEntity = AttachableStore.findAttachmentTarget(parent);
      this.checkCircularAttachment(parentEntity);

      this.attachedParent = parentEntity;
      parentEntity.setAttachment(this);
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

  private setAttachment(child: Attachable): void {
    if (this.destroyed) {
      this.destroyAttachment(child);
    } else {
      this.attachments.push(child);
    }
  }

  private removeAttachment(child: Attachable): void {
    let index = this.attachments.indexOf(child);
    if (index >= 0) {
      this.attachments.splice(index, 1);
    }
  }

  private checkCircularAttachment(parentEntity: Attachable | undefined): void {
    while (parentEntity) {
      if (parentEntity === this) {
        throw new Error(`Circular attachment detected!`);
      }
      parentEntity = parentEntity.attachedParent;
    }
  }

  private destroyAttachment(object: Attachable): void {
    if (Comparator.isObject(object)) {
      let item: any = object;
      if (Comparator.isFunction(item.destroy)) {
        item.destroy();
        return;
      } else if (Comparator.isFunction(item.unsubscribe)) {
        item.unsubscribe();
        return;
      }
    }

    throw new Error(`AttachmentTarget: destroyAttachment is used with not supperted type! Target: "${object}"`);
  }
}
