import { AttachmentTargetStore } from '../app/attachable/helpers/attachment-target.store';
import { ClassId } from '../app/attachable/helpers/class-id';

export class UnitTestHelper {
  static hardReset(): void {
    ClassId.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
