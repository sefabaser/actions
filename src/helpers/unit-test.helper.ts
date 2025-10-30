import { ClassID } from '..';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';

export class ActionLibUnitTestHelper {
  static hardReset(): void {
    ClassID.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
