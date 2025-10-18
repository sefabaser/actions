import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { UnitTestHelper } from '../helpers/unit-test.helper';
import { Reducer } from '../observables/reducer/reducer';

describe('Wait For All', () => {
  beforeEach(() => {
    UnitTestHelper.hardReset();
  });

  test('sample', () => {
    let triggered = false;
    // -------------------------------------------------------------
    let obj1 = new Attachable().attachToRoot();
    let obj2 = new Attachable().attachToRoot();
    let obj3 = new Attachable().attachToRoot();

    let all = Reducer.createExistenceChecker();
    all.effect().attach(obj1);
    all.effect().attach(obj2);
    all.effect().attach(obj3);
    all
      .waitUntil(false, () => {
        triggered = true;
      })
      .attachToRoot();
    // -------------------------------------------------------------

    expect(triggered).toBe(false);
    obj1.destroy();
    expect(triggered).toBe(false);
    obj2.destroy();
    expect(triggered).toBe(false);
    obj3.destroy();
    expect(triggered).toBe(true);
  });

  test('irregular', () => {
    let triggered = false;
    // -------------------------------------------------------------

    let obj1 = new Attachable().attachToRoot();
    obj1.destroy();
    let obj2 = new Attachable().attachToRoot();
    let obj3 = new Attachable().attachToRoot();

    let all = Reducer.createExistenceChecker();
    all.effect().attach(obj1);
    all.effect().attach(obj2);
    obj2.destroy();
    all.effect().attach(obj3);
    all
      .waitUntil(false, () => {
        triggered = true;
      })
      .attachToRoot();
    // -------------------------------------------------------------

    expect(triggered).toBe(false);
    obj3.destroy();
    expect(triggered).toBe(true);
  });
});
