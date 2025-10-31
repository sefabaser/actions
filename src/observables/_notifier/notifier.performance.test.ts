import { describe, test } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { PerformanceUnitTestHelper } from '../../sequence/performance-unit-test.helper';
import { Action } from '../action/action';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('take 1', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new Attachable();
      action
        .take(1)
        .read(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.9900999069213867
  }, 60000);
});
