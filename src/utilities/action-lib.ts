import { Attachable } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { ClassID } from '../attachable/helpers/class-id';
import { Reducer } from '../observables/reducer/reducer';
import { SingleEvent } from '../stream/single-event/single-event';

export class ActionLib {
  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns SingleEvent
   */
  static untilAllDestroyed(attachables: Attachable[]): SingleEvent {
    let allReducer = Reducer.createExistenceChecker();
    let allEffectChannels = attachables.map(attachable => allReducer.effect().attach(attachable));

    return SingleEvent.create((resolve, context) => {
      allReducer
        .filter(value => value === false)
        ._subscribeSingle(() => resolve())
        .attach(context.attachable);
      return () => {
        for (let i = 0; i < allEffectChannels.length; i++) {
          allEffectChannels[i].destroy();
        }
      };
    });
  }

  /**
   * Resets everything. Helps unit tests to run without effecting each other if called before each test.
   */
  static hardReset(): void {
    ClassID._hardReset();
    AttachmentTargetStore._hardReset();
  }
}
