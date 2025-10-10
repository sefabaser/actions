import { Comparator } from 'helpers-lib';

import { Attachable } from './attachable';

export class AttachmentTargetStore {
  private static nextAvailableIds = new WeakMap<typeof Attachable, number>();

  private static idToAttachmentTarget = new Map<string, Attachable>();
  private static idToAttachmentTargetClass = new Map<string, typeof Attachable>();

  static findAttachmentTarget(attachableCandidate: Attachable | string): Attachable {
    let attachmentTarget: Attachable;
    if (Comparator.isString(attachableCandidate)) {
      let attachableId: string = attachableCandidate as string;
      attachmentTarget = this.idToAttachmentTarget.get(attachableId) as Attachable;
      if (!attachmentTarget) {
        throw new Error(`Attachable: attachable not found by id! id: ${attachableId}`);
      }
    } else {
      attachmentTarget = attachableCandidate as Attachable;
    }
    return attachmentTarget;
  }

  static registerAttachmentTarget(attachmentTarget: Attachable): string {
    let Class = attachmentTarget.constructor as typeof Attachable;

    let numberPartOfTheId = this.nextAvailableIds.get(Class) || 1;
    this.nextAvailableIds.set(Class, numberPartOfTheId + 1);

    let classId = Class.id;
    let id = `${classId}:${numberPartOfTheId}`;

    this.idToAttachmentTarget.set(id, attachmentTarget);
    this.idToAttachmentTargetClass.set(id, Class);
    return id;
  }

  static unregisterAttachmentTarget(attachmentTarget: Attachable): void {
    this.idToAttachmentTarget.delete(attachmentTarget.id);
    this.idToAttachmentTargetClass.delete(attachmentTarget.id);
  }

  static validateIdForClass(id: string, expectedConstructor: typeof Attachable): boolean {
    let actualConstructor = this.idToAttachmentTargetClass.get(id);
    return actualConstructor === expectedConstructor;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   * @internal
   */
  static hardReset(): void {
    this.nextAvailableIds = new WeakMap<typeof Attachable, number>();
    this.idToAttachmentTarget.clear();
    this.idToAttachmentTargetClass.clear();
  }
}
