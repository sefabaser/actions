import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { IAttachable } from '../attachable/lightweight-attachable';
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

class CallbackUtilities {
  static takeFirst<T>(
    executor: (operation: Attachable & { resolve: (data: T) => void }) => void,
    callback: (data: T) => void
  ): IAttachable {
    let destroyOnResolve = new DestroyOnResolve<T>(callback);
    executor(destroyOnResolve);
    return destroyOnResolve;
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

    CallbackUtilities.takeFirst<string>(
      executor => {
        action1.waitUntil('1', data => executor.resolve(data + '1')).attach(executor);
        action2.waitUntil('2', data => executor.resolve(data + '2')).attach(executor);
      },
      data => {
        resolvedBy = data;
        resolvedCount++;
      }
    );

    expect(resolvedBy).toBeUndefined();
    expect(resolvedCount).toEqual(0);

    action1.value = '1';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);

    action2.value = '2';
    expect(resolvedBy).toEqual('11');
    expect(resolvedCount).toEqual(1);
  });
});
