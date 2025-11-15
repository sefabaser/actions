import { IDAttachable } from '../id-attachable';

/** @internal */
export class AttachmentTargetStore {
  private static _nextAvailableID = 1;
  private static _storage = new Map<number, { instance: IDAttachable; class: typeof IDAttachable }>();

  static findAttachmentTarget(attachableCandidate: number): IDAttachable {
    let item = this._storage.get(attachableCandidate);
    if (!item) {
      throw new Error(`Attachable: attachable not found by id! id: ${attachableCandidate}`);
    }
    return item.instance;
  }

  static registerIDAttachable(attachmentTarget: IDAttachable): number {
    let Class = attachmentTarget.constructor as typeof IDAttachable;

    let id = this._nextAvailableID++;

    this._storage.set(id, { instance: attachmentTarget, class: Class });
    return id;
  }

  static unregisterIDAttachable(attachmentTarget: IDAttachable): void {
    this._storage.delete(attachmentTarget.id);
  }

  static validateIDForClass(id: number, expectedConstructor: typeof IDAttachable): boolean {
    let item = this._storage.get(id);
    return item?.class === expectedConstructor;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   */
  static hardReset(): void {
    this._nextAvailableID = 1;
    this._storage.clear();
  }
}
