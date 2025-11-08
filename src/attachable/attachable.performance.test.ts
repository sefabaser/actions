import { describe, test } from 'vitest';

import { IDAttachable } from '../attachable/id-attachable';
import { PerformanceUnitTestHelper } from '../sequence/performance-unit-test.helper';
import { Attachable } from './attachable';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('object create destroy', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let object = new Attachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.10060000419616699
  }, 60000);

  test('object create destroy', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let object = new IDAttachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.38810014724731445
  }, 60000);
});
