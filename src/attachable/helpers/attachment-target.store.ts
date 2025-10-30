import { BaseAttachable } from '../base-attachable';

/** @internal */
export class AttachmentTargetStore {
  private static nextAvailableIds = new WeakMap<typeof BaseAttachable, number>();

  private static idToAttachmentTarget = new Map<string, BaseAttachable>();
  private static idToAttachmentTargetClass = new Map<string, typeof BaseAttachable>();

  static findAttachmentTarget(attachableCandidate: string): BaseAttachable {
    let attachmentTarget = this.idToAttachmentTarget.get(attachableCandidate);
    if (!attachmentTarget) {
      throw new Error(`Attachable: attachable not found by id! id: ${attachableCandidate}`);
    }
    return attachmentTarget;
  }

  static register(classID: string, attachmentTarget: BaseAttachable): string {
    let Class = attachmentTarget.constructor as typeof BaseAttachable;

    let numberPartOfTheId = this.nextAvailableIds.get(Class) || 1;
    this.nextAvailableIds.set(Class, numberPartOfTheId + 1);

    let id = `${classID}:${numberPartOfTheId}`;

    this.idToAttachmentTarget.set(id, attachmentTarget);
    this.idToAttachmentTargetClass.set(id, Class);
    return id;
  }

  static unregisterID(id: string): void {
    this.idToAttachmentTarget.delete(id);
    this.idToAttachmentTargetClass.delete(id);
  }

  static validateIdForClass(id: string, expectedConstructor: typeof BaseAttachable): boolean {
    let actualConstructor = this.idToAttachmentTargetClass.get(id);
    return actualConstructor === expectedConstructor;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   */
  static hardReset(): void {
    this.nextAvailableIds = new WeakMap<typeof BaseAttachable, number>();
    this.idToAttachmentTarget.clear();
    this.idToAttachmentTargetClass.clear();
  }
}
