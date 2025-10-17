import { ClassId } from "..";
import { AttachmentTargetStore } from "../attachable/helpers/attachment-target.store";

export class UnitTestHelper {
  static hardReset(): void {
    ClassId.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
