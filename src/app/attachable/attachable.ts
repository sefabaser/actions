import { NotificationHelper } from '../../helpers/notification.helper';
import { Action } from '../action/action';
import { ActionSubscription } from '../notifier/action-subscription';
import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassId } from './helpers/class-id';
import { IAttachable, LightweightAttachable } from './lightweight-attachable';

export class Attachable extends ClassId {
  static validateId(this: typeof Attachable, id: string): boolean {
    return AttachmentTargetStore.validateIdForClass(id, this);
  }

  readonly id: string = AttachmentTargetStore.registerAttachmentTarget(this);

  private _attachedParent: Attachable | undefined;
  /** @internal */
  get attachedParent(): Attachable | undefined {
    return this._attachedParent;
  }

  private _attachIsCalled = false;
  private attachments: IAttachable[] = [];

  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  private _onDestroy: Action<void> | undefined;
  onDestroy(callback: () => void): ActionSubscription {
    if (this._destroyed) {
      NotificationHelper.notify(undefined, callback);
      return ActionSubscription.destroyed;
    } else {
      if (!this._onDestroy) {
        this._onDestroy = new Action<void>();
      }
      return this._onDestroy.subscribe(callback);
    }
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
      this._attachedParent?.removeAttachment(this);
      this._attachedParent = undefined;
      AttachmentTargetStore.unregisterAttachmentTarget(this);

      let onDestroyListeners = this._onDestroy?.listeners ?? [];

      let attachedEntities = [...this.attachments];
      attachedEntities.forEach(item => item.destroy());
      this.attachments = [];
      this._destroyed = true;
      this._onDestroy = undefined;

      onDestroyListeners.forEach(listener => NotificationHelper.notify(undefined, listener));
    }
  }

  attach(parent: Attachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
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
