import { CallbackHelper } from '../helpers/callback.helper';
import { SingleEvent } from '../sequence/single-event';
import { Attachable } from './attachable';
import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassID } from './helpers/class-id';

export class IDAttachable extends Attachable {
  // ----------------------------- CLASSID -----------------------------
  static get id(): string {
    return ClassID.getClassID(this);
  }

  get classId(): string {
    return (this.constructor as typeof IDAttachable).id;
  }
  // ----------------------------- END CLASSID -----------------------------

  readonly id: string = AttachmentTargetStore.registerIDAttachable(this);

  static validateId(this: typeof IDAttachable, id: string): boolean {
    return AttachmentTargetStore.validateIdForClass(id, this);
  }

  private _onDestroyListeners: Set<() => void> | undefined;

  destroy(): void {
    if (!this.destroyed) {
      AttachmentTargetStore.unregisterIDAttachable(this);

      let listeners = this._onDestroyListeners;
      this._onDestroyListeners = undefined;
      if (listeners) {
        for (let listener of listeners) {
          listener();
        }
      }

      super.destroy();
    }
  }

  onDestroy(callback?: () => void): SingleEvent<void> {
    if (this.destroyed) {
      if (callback) {
        CallbackHelper.triggerCallback(undefined, callback);
      }
      return SingleEvent.create<void>(resolve => resolve());
    } else {
      if (!this._onDestroyListeners) {
        this._onDestroyListeners = new Set();
      }

      return SingleEvent.create<void>(resolve => {
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
}
