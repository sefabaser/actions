import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Action } from '../action/action';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('action subscribe single', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription = action.subscribe(() => {}).attachToRoot();
      action.trigger();
      subscription.destroy();
    });
    // Min:  0.8124001026153564
    // default attachable: 0.46429991722106934
    // no attachable: 0.24699997901916504
    // queueMicrotask: 0.2100999355316162
  }, 60000);

  test('action subscribe 10x', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription0 = action.subscribe(() => {}).attachToRoot();
      let subscription1 = action.subscribe(() => {}).attachToRoot();
      let subscription2 = action.subscribe(() => {}).attachToRoot();
      let subscription3 = action.subscribe(() => {}).attachToRoot();
      let subscription4 = action.subscribe(() => {}).attachToRoot();
      let subscription5 = action.subscribe(() => {}).attachToRoot();
      let subscription6 = action.subscribe(() => {}).attachToRoot();
      let subscription7 = action.subscribe(() => {}).attachToRoot();
      let subscription8 = action.subscribe(() => {}).attachToRoot();
      let subscription9 = action.subscribe(() => {}).attachToRoot();
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
      subscription0.destroy();
      subscription1.destroy();
      subscription2.destroy();
      subscription3.destroy();
      subscription4.destroy();
      subscription5.destroy();
      subscription6.destroy();
      subscription7.destroy();
      subscription8.destroy();
      subscription9.destroy();
    });
    // Min:  8.138400077819824
    // default attachable: 7.991199970245361
    // no attachable: 5.665599822998047
    // queueMicrotask: 5.307699918746948
  }, 60000);

  test('manual take next', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription = action.subscribe(() => subscription.destroy()).attachToRoot();
      action.trigger();
    });
    // no attachable: 0.24489998817443848
    // queueMicrotask: 0.2200000286102295
  }, 60000);

  test('take 1', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription = action
        .take(1)
        .read(() => {})
        .attachToRoot();
      action.trigger();
      subscription.destroy();
    });
    // Min: 1.1456000804901123
    // default attachable: 0.9167001247406006
    // no attachable: 0.6552000045776367
    // manual destruction of the sequence: 0.6094000339508057
    // queueMicrotask: 0.5599000453948975
  }, 60000);

  test('action to sequence read', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let sequence = action
        .toSequence()
        .read(() => {})
        .attachToRoot();
      action.trigger();
      sequence.destroy();
    });
    // Min:  1.2650001049041748
    // default attachable: 0.8048000335693359
    // no attachable: 0.5906000137329102
    // manual destruction of the sequence: 0.5377998352050781
    // queueMicrotask: 0.4574000835418701
  }, 60000);
});
