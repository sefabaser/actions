import { describe, test } from 'vitest';

import { IDAttachable } from '../attachable/id-attachable';
import { UnitTestHelper } from '../sequence/delayed-sequential-calls.helper';
import { Attachable } from './attachable';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('no op', async () => {
    await UnitTestHelper.testPerformance(() => {});
    // Min:  0.0004000663757324219
  }, 60000);

  test('object create destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new Attachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.10060000419616699
  }, 60000);

  test('object create destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new IDAttachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.38810014724731445
  }, 60000);

  test('onDestroy callback', async () => {
    await UnitTestHelper.testPerformance(() => {
      let attachable = new IDAttachable().attachToRoot();
      attachable
        .onDestroy()
        .read(() => {})
        .attachToRoot();
      attachable.destroy();
    });
    // Min:  0.7037999629974365
  }, 60000);
});
