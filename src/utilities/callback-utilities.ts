import { Attachable } from '../attachable/attachable';
import { IDAttachable } from '../attachable/id-attachable';
import { Reducer } from '../observables/reducer/reducer';
import { IStream, Sequence } from '../sequence/sequence';

export class CallbackUtilities {
  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns Sequence
   *
   * Sample:
   *  CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3], () => {
   *    // All entities are destroyed
   *  }).attachToRoot();
   */
  static untilAllDestroyed(attachables: Attachable[]): Sequence {
    let allReducer = Reducer.createExistenceChecker();
    let allEffectChannels = attachables.map(attachable => allReducer.effect().attach(attachable));

    return Sequence.create((resolve, attachable) => {
      allReducer.waitUntil(false, () => resolve()).attach(attachable);
      return () => allEffectChannels.forEach(channel => channel.destroy());
    });
  }

  // TODO: performance comparison
  static untilAllDestroyed2(attachables: IDAttachable[]): Sequence {
    return Sequence.combine(
      attachables.reduce(
        (acc, item, index) => {
          acc[index] = item.onDestroy();
          return acc;
        },
        {} as Record<string, IStream>
      )
    )
      .take(1)
      .map(() => {});
  }
}
