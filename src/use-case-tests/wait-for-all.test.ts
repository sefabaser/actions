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
    let all = Reducer.createExistenceChecker();

    let obj1 = new Attachable().attachToRoot();
    all.effect().attach(obj1);

    let obj2 = new Attachable().attachToRoot();
    all.effect().attach(obj2);

    let obj3 = new Attachable().attachToRoot();
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
    let all = Reducer.createExistenceChecker();

    let obj1 = new Attachable().attachToRoot();
    obj1.destroy();
    all.effect().attach(obj1);

    let obj2 = new Attachable().attachToRoot();
    all.effect().attach(obj2);

    let obj3 = new Attachable().attachToRoot();
    all.effect().attach(obj3);

    obj2.destroy();

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
