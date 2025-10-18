import { beforeEach, describe, expect, test, vi } from 'vitest';

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
    }).attachToRoot();
  }
}

/**
 * Assume that this is a separate file
 * Lets say we have lots of different files are effecting to show loading indicator.
 */
class SomeAsyncService {
  asyncOperation(): void {
    let blocker = Blockers.effect().attachToRoot();
    setTimeout(() => {
      // after an async operation
      blocker.destroy();
    }, 3);
  }
}

describe(`Reducer Sample Scenario`, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('notify everyone if loading indicater state changes', () => {
    let loadingIndicator = new LoadingIndicator();

    let async1 = new SomeAsyncService();
    let async2 = new SomeAsyncService();

    async1.asyncOperation();
    expect(loadingIndicator.screenIsBlocked).toBe(true);
    expect(loadingIndicator.triggerCount).toBe(2);

    vi.advanceTimersByTime(1);

    // during first call still happening
    async2.asyncOperation();
    // in here still we expect to see no trigger
    expect(loadingIndicator.screenIsBlocked).toBe(true);
    expect(loadingIndicator.triggerCount).toBe(2);

    vi.advanceTimersByTime(1);

    // after first call is completed but still in second call
    // in here still we expect to see no trigger because second operation is still happening
    expect(loadingIndicator.screenIsBlocked).toBe(true);
    expect(loadingIndicator.triggerCount).toBe(2);

    vi.advanceTimersByTime(7);

    // after both calls are completed
    expect(loadingIndicator.screenIsBlocked).toBe(false);
    expect(loadingIndicator.triggerCount).toBe(3);

    vi.useRealTimers();
  });
});
