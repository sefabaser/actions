import { describe, test } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { PerformanceUnitTestHelper } from '../../sequence/performance-unit-test.helper';
import { Action } from '../action/action';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('action subscribe single', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.8124001026153564
    // default attachable: 0.46429991722106934
  }, 60000);

  test('action subscribe 10x', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      parent.destroy();
    });
    // Min:  8.138400077819824
    // default attachable: 7.991199970245361
  }, 60000);

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
    // Min: 1.1456000804901123
    // default attachable: 0.9167001247406006
  }, 60000);
});
