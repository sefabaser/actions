import { beforeEach, describe, expect, test } from 'vitest';

import { UnitTestHelper } from '../helpers/unit-test.helper';
import { ActionSubscription } from '../observables/_notifier/action-subscription';
import { Variable } from '../observables/variable/variable';

describe('Wait For Any', () => {
  beforeEach(() => {
    UnitTestHelper.hardReset();
  });

  test('sample 1: regular', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let resolved = false;
    let sub1: ActionSubscription | undefined;
    let sub2: ActionSubscription | undefined;
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!resolved) {
        sub1?.destroy();
        sub2?.destroy();
        resolved = true;
        resolvedBy = data;
        resolvedCount++;
      }
    };

    if (!resolved) {
      sub1 = action1.waitUntilNext(data => resolve(data + '1')).attachToRoot();
    }
    if (!resolved) {
      sub2 = action2.waitUntilNext(data => resolve(data + '2')).attachToRoot();
    }

    expect(resolvedBy).toBeUndefined();
    expect(resolvedCount).toEqual(0);

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 2: one resolved already', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let resolved = false;
    let sub1: ActionSubscription | undefined;
    let sub2: ActionSubscription | undefined;
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!resolved) {
        sub1?.destroy();
        sub2?.destroy();
        resolved = true;
        resolvedBy = data;
        resolvedCount++;
      }
    };

    if (!resolved) {
      sub1 = action1.waitUntilNext(data => resolve(data + '1')).attachToRoot();
    }

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    if (!resolved) {
      sub2 = action2.waitUntilNext(data => resolve(data + '2')).attachToRoot();
    }

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });
});
