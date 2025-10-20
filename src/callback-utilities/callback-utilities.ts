import { Attachable, IAttachable } from '../attachable/attachable';
import { Reducer } from '../observables/reducer/reducer';

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
  static untilAllDestroyed(attachables: Attachable[], callback: () => void): IAttachable {
    let all = Reducer.createExistenceChecker();
    attachables.forEach(attachable => all.effect().attach(attachable));
    return all.waitUntil(false, callback);
  }
}
