import { IDAttachable } from '../id-attachable';

/** @internal */
export class AttachmentTargetStore {
  private static nextAvailableIds = new WeakMap<typeof IDAttachable, number>();

  private static idToAttachmentTarget = new Map<string, IDAttachable>();
  private static idToAttachmentTargetClass = new Map<string, typeof IDAttachable>();

  static findAttachmentTarget(attachableCandidate: string): IDAttachable {
    let attachmentTarget = this.idToAttachmentTarget.get(attachableCandidate);
    if (!attachmentTarget) {
      throw new Error(`Attachable: attachable not found by id! id: ${attachableCandidate}`);
    }
    return attachmentTarget;
  }

  static registerIDAttachable(attachmentTarget: IDAttachable): string {
    let Class = attachmentTarget.constructor as typeof IDAttachable;

    let numberPartOfTheId = this.nextAvailableIds.get(Class) || 1;
    this.nextAvailableIds.set(Class, numberPartOfTheId + 1);

    let classId = Class.id;
    let id = `${classId}:${numberPartOfTheId}`;

    this.idToAttachmentTarget.set(id, attachmentTarget);
    this.idToAttachmentTargetClass.set(id, Class);
    return id;
  }

  static unregisterIDAttachable(attachmentTarget: IDAttachable): void {
    this.idToAttachmentTarget.delete(attachmentTarget.id);
    this.idToAttachmentTargetClass.delete(attachmentTarget.id);
  }

  static validateIdForClass(id: string, expectedConstructor: typeof IDAttachable): boolean {
    let actualConstructor = this.idToAttachmentTargetClass.get(id);
    return actualConstructor === expectedConstructor;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   */
  static hardReset(): void {
    this.nextAvailableIds = new WeakMap<typeof IDAttachable, number>();
    this.idToAttachmentTarget.clear();
    this.idToAttachmentTargetClass.clear();
  }
}
