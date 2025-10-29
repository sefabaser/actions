import { Attachable } from '../attachable/attachable';
import { Reducer } from '../observables/reducer/reducer';
import { Sequence } from '../sequence/sequence';

export class CallbackUtilities {
  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns IAttachable to cancel the operation early if needed.
   *
   * Sample:
   *  CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3], () => {
   *    // All entities are destroyed
   *  }).attachToRoot();
   */
  static untilAllDestroyed(attachables: Attachable[]): Sequence {
    let all = Reducer.createExistenceChecker();
    attachables.forEach(attachable => all.effect().attach(attachable));
    return Sequence.create(resolve => {
      // TODO: get an attachable or return and attachable to be destroyed
      let subscription = all.waitUntil(false, () => resolve()).attachToRoot();
      return () => {
        subscription.destroy();
      };
    });
  }
}
