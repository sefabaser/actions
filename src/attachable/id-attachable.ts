import { SingleEvent } from '../stream/single-event/single-event';
import { Attachable } from './attachable';
import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassID } from './helpers/class-id';

export class IDAttachable extends Attachable {
  // ----------------------------- CLASSID -----------------------------
  static get id(): number {
    return ClassID.getClassID(this);
  }

  get classID(): number {
    return (this.constructor as typeof IDAttachable).id;
  }
  // ----------------------------- END CLASSID -----------------------------

  readonly id: number = AttachmentTargetStore._registerIDAttachable(this);

  static validateID(this: typeof IDAttachable, id: number): boolean {
    return AttachmentTargetStore._validateIDForClass(id, this);
  }

  private _onDestroyListeners: Set<() => void> | undefined;

  destroy(): void {
    if (!this._destroyed) {
      AttachmentTargetStore._unregisterIDAttachable(this);

      let listeners = this._onDestroyListeners;
      this._onDestroyListeners = undefined;
      super.destroy();

      if (listeners) {
        // all race conditions are covered for this case, and no need to take snapshot of the listeners.
        for (let listener of listeners) {
          // this listener does not need to be wrapped, it is triggering single events, they will handle it.
          listener();
        }
      }
    }
  }

  onDestroy(): SingleEvent<void> {
    if (this._destroyed) {
      return SingleEvent.instant();
    } else {
      if (!this._onDestroyListeners) {
        this._onDestroyListeners = new Set();
      }

      return SingleEvent.create<void>(resolve => {
        this._onDestroyListeners!.add(resolve);
        return () => {
          this._onDestroyListeners?.delete(resolve);
        };
      });
    }
  }
}
