import { Comparator } from 'helpers-lib';

import { ActionSubscription } from './notification-handler';
import { Reducer } from '../app/reducer/reducer';
import { Variable } from '../app/variable/variable';

/**
 * IMPORTANT: In case of AOT build, components should define 'ngOnInit' and 'ngOnDestroy' even tough they are empty
 * AOT build is stripping decorator defined functions, therefore angular cannot trigger decorator defined ngOnInit and ngOnDestroy functions
 */
export function SubscribeAction(action: Variable<any> | Reducer<any, any>) {
  return function(constructor: any, key: string) {
    let subscription: ActionSubscription;

    let initCallback = constructor.ngOnInit;
    let destroyCallback = constructor.ngOnDestroy;
    if (!Comparator.isFunction(initCallback)) {
      console.error(`You cannot use 'SubscribeAction' without ngOnInit! "${key}"`);
    }
    if (!Comparator.isFunction(destroyCallback)) {
      console.error(`You cannot use 'SubscribeAction' without ngOnDestroy! "${key}"`);
    }

    constructor.ngOnInit = function() {
      if (action instanceof Variable) {
        subscription = action.subscribe(item => {
          this[key] = item;
        });
      } else {
        subscription = action.subscribe(item => {
          this[key] = item;
        });
      }

      Comparator.isFunction(initCallback) && initCallback.bind(this)();
    };

    constructor.ngOnDestroy = function() {
      Comparator.isFunction(destroyCallback) && destroyCallback.bind(this)();
      subscription && subscription.unsubscribe();
    };
  };
}

/**
 * IMPORTANT: In case of AOT build, components should define 'ngOnDestroy' even tough it is empty
 * AOT build is stripping decorator defined functions, therefore angular cannot trigger decorator defined ngOnInit and ngOnDestroy functions
 */
export function AutoSubscription() {
  return function(constructor: any, key: string) {
    let destroyCallback = constructor.ngOnDestroy;
    if (!Comparator.isFunction(destroyCallback)) {
      console.error(`You cannot use 'AutoSubscription' without ngOnDestroy! "${key}"`);
    }

    constructor.ngOnDestroy = function() {
      destroyCallback && destroyCallback.bind(this)();
      let subscription = this[key];
      subscription && subscription.unsubscribe();
    };
  };
}
