import { ClassId } from '..';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';

export class ActionLibUnitTestHelper {
  static hardReset(): void {
    ClassId.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
