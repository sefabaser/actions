import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { UnitTestHelper } from '../helpers/unit-test.helper';
import { Variable } from '../observables/variable/variable';

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

describe('Wait For Any', () => {
  beforeEach(() => {
    UnitTestHelper.hardReset();
  });

  test('sample 1: regular', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let destroyOnResolve = new DestroyOnResolve<string>(data => {
      resolvedBy = data;
      resolvedCount++;
    }).attachToRoot();

    action1.waitUntil('1', data => destroyOnResolve.resolve(data + '1')).attach(destroyOnResolve);
    action2.waitUntil('2', data => destroyOnResolve.resolve(data + '2')).attach(destroyOnResolve);

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

    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let destroyOnResolve = new DestroyOnResolve<string>(data => {
      resolvedBy = data;
      resolvedCount++;
    }).attachToRoot();

    action1.waitUntil('1', data => destroyOnResolve.resolve(data + '1')).attach(destroyOnResolve);

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => destroyOnResolve.resolve(data + '2')).attach(destroyOnResolve);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 3: one resolved beforehand', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let destroyOnResolve = new DestroyOnResolve<string>(data => {
      resolvedBy = data;
      resolvedCount++;
    }).attachToRoot();

    action1.value = '1';
    action1.waitUntil('1', data => destroyOnResolve.resolve(data + '1')).attach(destroyOnResolve);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => destroyOnResolve.resolve(data + '2')).attach(destroyOnResolve);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });

  test('sample 4: both resolved beforehand', () => {
    let action1 = new Variable<string>('');
    let action2 = new Variable<string>('');

    let resolvedBy: string | undefined;
    let resolvedCount = 0;

    let destroyOnResolve = new DestroyOnResolve<string>(data => {
      resolvedBy = data;
      resolvedCount++;
    }).attachToRoot();

    action1.value = '1';
    action2.value = '2';

    action1.waitUntil('1', data => destroyOnResolve.resolve(data + '1')).attach(destroyOnResolve);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.waitUntil('2', data => destroyOnResolve.resolve(data + '2')).attach(destroyOnResolve);

    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });
});
