import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { UnitTestHelper } from '../helpers/unit-test.helper';
import { Variable } from '../observables/variable/variable';

describe('Wait For Any', () => {
  beforeEach(() => {
    UnitTestHelper.hardReset();
  });

  test('sample 1: regular', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let any = new Attachable().attachToRoot();
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!any.destroyed) {
        any.destroy();
        resolvedBy = data;
        resolvedCount++;
      }
    };

    action1.waitUntil('1', data => resolve(data + '1')).attach(any);
    action2.waitUntil('2', data => resolve(data + '2')).attach(any);

    expect(resolvedBy).toBeUndefined();
    expect(resolvedCount).toEqual(0);

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 2: one resolved in between', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let any = new Attachable().attachToRoot();
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!any.destroyed) {
        any.destroy();
        resolvedBy = data;
        resolvedCount++;
      }
    };

    action1.waitUntil('1', data => resolve(data + '1')).attach(any);

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => resolve(data + '2')).attach(any);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 3: one resolved beforehand', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let any = new Attachable().attachToRoot();
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!any.destroyed) {
        any.destroy();
        resolvedBy = data;
        resolvedCount++;
      }
    };

    action1.value = '1';
    action1.waitUntil('1', data => resolve(data + '1')).attach(any);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => resolve(data + '2')).attach(any);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 4: both resolved beforehand', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let any = new Attachable().attachToRoot();
    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let resolve = (data: string) => {
      if (!any.destroyed) {
        any.destroy();
        resolvedBy = data;
        resolvedCount++;
      }
    };

    action1.value = '1';
    action2.value = '2';

    action1.waitUntil('1', data => resolve(data + '1')).attach(any);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => resolve(data + '2')).attach(any);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });
});
