import { describe, test } from 'vitest';

import { Reducer } from './reducer';

/**
 * Scenario: I want to show loading indicator if there is at least one blocker such as endpoint call.
 * The trick here is, at the same there there might be multiple blockers, starting in different times, but intersecting to each other.
 * So i only want to know endresult: Is anyone blocking at the moment?
 * I want to continuesly informed if the answer of this question changes.
 */

/**
 * Assume that this is a separate file
 */
const Blockers = Reducer.createExistenceChecker();

/**
 * Assume that this is a separate file
 * In here we will listen our reducer and when its value changes, we will block or unblock the screen.
 */
class LoadingIndicator {
  screenIsBlocked = false;
  triggerCount = 0;

  constructor() {
    Blockers.subscribe(blockerExist => {
      this.screenIsBlocked = blockerExist;
      this.triggerCount++;
    });
  }
}

/**
 * Assume that this is a separate file
 * Lets say we have lots of different files are effecting to show loading indicator.
 */
class SomeAsyncService {
  asyncOperation(): void {
    let blocker = Blockers.effect();
    setTimeout(() => {
      // after an async operation
      blocker.destroy();
    }, 3);
  }
}

describe(`Reducer Sample Scenario`, () => {
  test('notify everyone if loading indicater state changes', () =>
    new Promise<void>(done => {
      let loadingIndicator = new LoadingIndicator();

      let async1 = new SomeAsyncService();
      let async2 = new SomeAsyncService();

      let successful = true;

      async1.asyncOperation();
      if (!(loadingIndicator.screenIsBlocked === true && loadingIndicator.triggerCount === 2)) {
        successful = false;
        console.error('Reducer Sample Scenario: first operation error!');
      }

      setTimeout(() => {
        // during first call still happening
        async2.asyncOperation();
        // in here still we expect to see no trigger
        if (!(loadingIndicator.screenIsBlocked === true && loadingIndicator.triggerCount === 2)) {
          successful = false;
          console.error('Reducer Sample Scenario: second operation error 1!');
        }

        setTimeout(() => {
          // after first call is completed but still in second call
          // in here still we expect to see no trigger because second operation is still happening
          if (!(loadingIndicator.screenIsBlocked === true && loadingIndicator.triggerCount === 2)) {
            successful = false;
            console.error('Reducer Sample Scenario: second operation error 2!');
          }

          setTimeout(() => {
            // after both calls are completed
            if (!(loadingIndicator.screenIsBlocked === false && loadingIndicator.triggerCount === 3)) {
              successful = false;
              console.error('Reducer Sample Scenario: after operations error!');
            }

            if (successful) {
              done();
            }
          }, 7);
        }, 1);
      }, 1);
    }));
});
