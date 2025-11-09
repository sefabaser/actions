import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { IDAttachable } from '../attachable/id-attachable';
import { Attachable } from './attachable';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('no op', async () => {
    let i = 0;
    await UnitTestHelper.testPerformance(() => {
      i++;
      i++;
      i++;
      i++;
      i++;
      i++;
      i++;
      i++;
      i++;
      i++;
    });
    console.log(i);
    // Min:  0.0004000663757324219
  }, 60000);

  test('Attachable create and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new Attachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.10060000419616699
    // queueMicrotask: 0.06649994850158691
  }, 60000);

  test('Attachable create, attach and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      new Attachable().attach(parent);
      parent.destroy();
    });
    // Min:  0.24699997901916504
    // lazy circular dep check: 0.24099993705749512
  }, 60000);

  test('IDAttachable create and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new IDAttachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.38810014724731445
    // queueMicrotask: 0.35089993476867676
  }, 60000);

  test('onDestroy callback', async () => {
    await UnitTestHelper.testPerformance(() => {
      let attachable = new IDAttachable().attachToRoot();
      attachable.onDestroy(() => {}).attachToRoot();
      attachable.destroy();
    });
    // Min:  0.7037999629974365
    // queueMicrotask: 0.6494998931884766
  }, 60000);
});
