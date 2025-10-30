import { beforeEach, describe, expect, test } from 'vitest';

import { IAttachable, LightweightAttachable } from '../attachable/lightweight-attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Reducer } from '../observables/reducer/reducer';

class CallbackUtilities {
  static untilAllDestroyed(attachables: LightweightAttachable[], callback: () => void): IAttachable {
    let all = Reducer.createExistenceChecker();
    attachables.forEach(attachable => all.effect().attach(attachable));
    return all.waitUntil(false, callback);
  }
}

describe('UntilAllDestroyed', () => {
  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  test('sample', () => {
    // -------------------------------------------------------------
    let obj1 = new LightweightAttachable().attachToRoot();
    let obj2 = new LightweightAttachable().attachToRoot();
    let obj3 = new LightweightAttachable().attachToRoot();

    let triggered = false;
    CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3], () => {
      triggered = true;
    }).attachToRoot();

    expect(triggered).toBe(false);
    obj1.destroy();
    expect(triggered).toBe(false);
    obj2.destroy();
    expect(triggered).toBe(false);
    obj3.destroy();
    expect(triggered).toBe(true);
  });
});

describe('With reducer', () => {
  test('sample', () => {
    let triggered = false;
    // -------------------------------------------------------------
    let obj1 = new LightweightAttachable().attachToRoot();
    let obj2 = new LightweightAttachable().attachToRoot();
    let obj3 = new LightweightAttachable().attachToRoot();

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

    let obj1 = new LightweightAttachable().attachToRoot();
    obj1.destroy();
    let obj2 = new LightweightAttachable().attachToRoot();
    let obj3 = new LightweightAttachable().attachToRoot();

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
