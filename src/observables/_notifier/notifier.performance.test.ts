import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Action, Variable } from '../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('build test', async () => {
    let action = new Action<void>();
    let subscription = action.subscribe(() => console.log('okay')).attachToRoot();
    action.trigger();
    subscription.destroy();
  });

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
    // trigger all change: 0.19009995460510254
    // 0.18709993362426758
    // read single changes: 0.1697998046875
    // 0.15889999270439148
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
    // queueMicrotask: 5.21779990196228
    // trigger all change: 4.310899972915649
    // read single changes: 4.205600261688232
    // 2.3874001502990723
  }, 60000);

  test('variable subscribe and set 10x', async () => {
    let variable = new Variable<string>('');
    await UnitTestHelper.testPerformance(() => {
      let subscription0 = variable.subscribe(() => {}).attachToRoot();
      let subscription1 = variable.subscribe(() => {}).attachToRoot();
      let subscription2 = variable.subscribe(() => {}).attachToRoot();
      let subscription3 = variable.subscribe(() => {}).attachToRoot();
      let subscription4 = variable.subscribe(() => {}).attachToRoot();
      let subscription5 = variable.subscribe(() => {}).attachToRoot();
      let subscription6 = variable.subscribe(() => {}).attachToRoot();
      let subscription7 = variable.subscribe(() => {}).attachToRoot();
      let subscription8 = variable.subscribe(() => {}).attachToRoot();
      let subscription9 = variable.subscribe(() => {}).attachToRoot();
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
      variable.set('');
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
    // 4.546999931335449
    // splitting set functions: 4.5386998653411865
    // read single changes: 4.561299800872803
    // 2.5963997840881348
  }, 60000);

  test('manual take next', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription = action.subscribe(() => subscription.destroy()).attachToRoot();
      action.trigger();
    });
    // no attachable: 0.24489998817443848
    // queueMicrotask: 0.2200000286102295
    // trigger all change: 0.20089983940124512
    // read single changes: 0.17659997940063477
  }, 60000);

  test('take 1', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let subscription = action
        .take(1)
        .map(() => {})
        .attachToRoot();
      action.trigger();
      subscription.destroy();
    });
    // Min: 1.1456000804901123
    // default attachable: 0.9167001247406006
    // no attachable: 0.6552000045776367
    // manual destruction of the sequence: 0.6094000339508057
    // queueMicrotask: 0.5446999073028564
    // trigger all change: 0.5025999546051025
    // read single changes: 0.5067000389099121
    // 0.3692000061273575
  }, 60000);

  test('take one by single event', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      action
        .toSingleEvent()
        .read(() => {})
        .attachToRoot();
      action.trigger();
    });
    // 0.294500008225441
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
    // queueMicrotask: 0.4397001266479492
    // trigger all change: 0.43720006942749023
    // read single changes: 0.4247000217437744
    // removing bind: 0.40780019760131836
    // manual subscription: 0.32919979095458984
    // 0.3164000064134598
  }, 60000);

  test('action to single event read', async () => {
    let action = new Action<void>();
    await UnitTestHelper.testPerformance(() => {
      let sequence = action
        .toSingleEvent()
        .read(() => {})
        .attachToRoot();
      action.trigger();
      sequence.destroy();
    });
    // 0.3113999366760254
  }, 60000);

  test('action to notifier', async () => {
    await UnitTestHelper.testPerformance(() => {
      let action = new Action<void>();
      action.notifier.subscribe(() => {}).attachToRoot();
      action.trigger();
    });
    // Min:  0.20210027694702148
    // 0.18799999356269836
  }, 60000);
});
