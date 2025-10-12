import { AttachmentTargetStore } from './app/attachable/helpers/attachment-target.store';
import { ClassId } from './app/attachable/helpers/class-id';

export { Action, ActionListenerCallbackFunction, ActionOptions } from './app/action/action';
export { ObservableMap } from './app/data-structures/observable-map/observable-map';
export { ObservableSet } from './app/data-structures/observable-set/observable-set';
export { ActionSubscription } from './app/notifier/notification-handler';
export {
  Reducer,
  ReducerEffectChannel,
  ReducerOptions,
  ReducerReduceFunction,
  ReducerSubscriptionOptions
} from './app/reducer/reducer';
export {
  IVariable,
  Variable,
  VariableListenerCallbackFunction,
  VariableOptions,
  VariableSubscriptionOptions
} from './app/variable/variable';
export { ActionLibDefaults } from './config';

export class UnitTestHelper {
  static hardReset(): void {
    ClassId.hardReset();
    AttachmentTargetStore.hardReset();
  }
}
