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

  readonly id: string = AttachmentTargetStore.register(this.classId, this);

  static validateId(this: typeof IDAttachable, id: string): boolean {
    return AttachmentTargetStore.validateIdForClass(id, this);
  }

  destroy(): void {
    if (!this.destroyed) {
      AttachmentTargetStore.unregisterID(this.id);
      super.destroy();
    }
  }
}
