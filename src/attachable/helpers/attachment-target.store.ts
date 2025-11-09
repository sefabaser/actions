import { IAttachable } from '../attachable';
import { IDAttachable } from '../id-attachable';

/** @internal */
export class AttachmentTargetStore {
  private static nextAvailableId = 0;
  private static storage = new Map<string, { instance: IDAttachable; class: typeof IDAttachable }>();

  static findAttachmentTarget(attachableCandidate: string): IAttachable {
    let item = this.storage.get(attachableCandidate);
    if (!item) {
      throw new Error(`Attachable: attachable not found by id! id: ${attachableCandidate}`);
    }
    return item.instance;
  }

  static registerIDAttachable(attachmentTarget: IDAttachable): string {
    let Class = attachmentTarget.constructor as typeof IDAttachable;

    let id = this.nextAvailableId++ + '';

    this.storage.set(id, { instance: attachmentTarget, class: Class });
    return id;
  }

  static unregisterIDAttachable(attachmentTarget: IDAttachable): void {
    this.storage.delete(attachmentTarget.id);
  }

  static validateIdForClass(id: string, expectedConstructor: typeof IDAttachable): boolean {
    let item = this.storage.get(id);
    return item?.class === expectedConstructor;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   */
  static hardReset(): void {
    this.nextAvailableId = 0;
    this.storage.clear();
  }
}
