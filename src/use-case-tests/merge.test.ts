import { beforeEach, describe, test } from 'vitest';

import { UnitTestHelper } from '../helpers/unit-test.helper';
import { Variable } from '../observables/variable/variable';

describe('Merge', () => {
  beforeEach(() => {
    UnitTestHelper.hardReset();
  });

  test('sample', () => {
    let variable1 = new Variable<string>('');
    let variable2 = new Variable<string>('');
  });
});
