import { CallbackHelper } from '../helpers/callback.helper';
import { Sequence } from '../sequence/sequence';
import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassID } from './helpers/class-id';
import { IAttachable, LightweightAttachable } from './lightweight-attachable';

export class Attachable extends LightweightAttachable implements IAttachable {
  // ----------------------------- CLASSID -----------------------------
  static get id(): string {
    return ClassID.getClassID(this);
  }

  get classId(): string {
    return (this.constructor as typeof Attachable).id;
  }
  // ----------------------------- END CLASSID -----------------------------

  readonly id: string = AttachmentTargetStore.registerAttachmentTarget(this);

  static validateId(this: typeof Attachable, id: string): boolean {
    return AttachmentTargetStore.validateIdForClass(id, this);
  }

  private _onDestroyListeners: Set<() => void> | undefined;
  private _attachments: Set<IAttachable> | undefined;

  destroy(): void {
    if (!this.destroyed) {
      AttachmentTargetStore.unregisterAttachmentTarget(this);

      let listeners = this._onDestroyListeners;
      this._onDestroyListeners = undefined;
      listeners?.forEach(listener => listener());

      let attachedEntities = this._attachments;
      this._attachments = undefined;
      attachedEntities?.forEach(item => item.destroy());

      super.destroy();
    }
  }

  onDestroy(callback?: () => void): Sequence<void> {
    if (this.destroyed) {
      if (callback) {
        CallbackHelper.triggerCallback(undefined, callback);
      }
      return Sequence.create<void>(resolve => resolve());
    } else {
      if (!this._onDestroyListeners) {
        this._onDestroyListeners = new Set();
      }

      return Sequence.create<void>(resolve => {
        let listener = () => {
          if (callback) {
            CallbackHelper.triggerCallback(undefined, callback);
          }
          resolve();
        };
        this._onDestroyListeners!.add(listener);
        return () => {
          this._onDestroyListeners?.delete(listener);
        };
      });
    }
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
