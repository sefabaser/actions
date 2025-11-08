import { describe, test } from 'vitest';

import { IDAttachable } from '../..';
import { Attachable } from '../../attachable/attachable';
import { PerformanceUnitTestHelper } from '../../sequence/performance-unit-test.helper';
import { Action } from '../action/action';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('action subscribe single', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.8124001026153564
  }, 60000);

  test('action subscribe 10x', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
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
  }, 60000);
});
