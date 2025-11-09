import { Attachable } from '../attachable/attachable';
import { Reducer } from '../observables/reducer/reducer';
import { Sequence } from '../sequence/sequence';

export class ActionLibUtilities {
  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns Sequence
   */
  static untilAllDestroyed(attachables: Attachable[]): Sequence {
    let allReducer = Reducer.createExistenceChecker();
    let allEffectChannels = attachables.map(attachable => allReducer.effect().attach(attachable));

    return Sequence.create((resolve, context) => {
      allReducer
        .filter(value => value === false)
        .take(1)
        .read(() => resolve())
        .attach(context.attachable);
      return () => {
        for (let i = 0; i < allEffectChannels.length; i++) {
          allEffectChannels[i].destroy();
        }
      };
    });
  }
}
