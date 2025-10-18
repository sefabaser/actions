import { Attachable } from '../attachable/attachable';
import { IAttachable } from '../attachable/lightweight-attachable';
import { Reducer } from '../observables/reducer/reducer';

class DestroyOnResolve<T> extends Attachable {
  constructor(private onResolve: (data: T) => void) {
    super();
  }

  resolve(data: T) {
    if (!this.destroyed) {
      this.destroy();
      this.onResolve(data);
    }
  }
}

export class CallbackUtilities {
  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns IAttachable to cancel the operation early if needed.
   *
   * Sample:
   *  let entities = [obj1, obj2, obj3];
   *
   *  CallbackUtilities.untilAllDestroyed(entities, () => {
   *    // All entities are destroyed
   *  }).attachToRoot();
   */
  static untilAllDestroyed(attachables: Attachable[], callback: () => void): IAttachable {
    let all = Reducer.createExistenceChecker();
    attachables.forEach(attachable => all.effect().attach(attachable));
    return all.waitUntil(false, callback);
  }

  /**
   * @param executor Has two functionalities. To resolve the operation, and attaching all subscriptions to. Once it is resolved, the executor will be destroyed.
   * @param callback Called after first resolve.
   * @returns IAttachable to cancel the operation early if needed.
   *
   * Sample:
   *  let action1 = new Variable<string>('');
   *  let action2 = new Variable<string>('');
   *
   *  CallbackUtilities.takeFirst<string>(
   *    executor => {
   *      action1.waitUntil('1', data => executor.resolve(data)).attach(executor);
   *      action2.waitUntil('2', data => executor.resolve(data)).attach(executor);
   *    },
   *    data => {
   *      // data of the first resolution
   *    }
   *  ).attachToRoot();
   */
  static takeFirst<T>(
    executor: (operation: Attachable & { resolve: (data: T) => void }) => void,
    callback: (data: T) => void
  ): IAttachable {
    let destroyOnResolve = new DestroyOnResolve<T>(callback);
    executor(destroyOnResolve);
    return destroyOnResolve;
  }
}
