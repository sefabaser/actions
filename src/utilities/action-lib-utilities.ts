import { Attachable } from '../attachable/attachable';
import { Reducer } from '../observables/reducer/reducer';
import { SingleEvent } from '../sequence/single-event';

export class ActionLibUtilities {
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
        .readSingle(() => resolve())
        .attach(context.attachable);
      return () => {
        for (let i = 0; i < allEffectChannels.length; i++) {
          allEffectChannels[i].destroy();
        }
      };
    });
  }
}
