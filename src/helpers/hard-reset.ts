import { ClassID } from '..';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';

export class ActionLibHardReset {
  static hardReset(): void {
    ClassID.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
