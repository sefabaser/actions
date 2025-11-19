import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Sequence, SingleEvent } from '../../../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('base', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant().attachToRoot();
      sequence.destroy();
    });
    // 0.10050000250339508
  }, 60000);

  test('take one', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant().takeOne().attachToRoot();
      sequence.destroy();
    });
    // 0.21639999747276306
  }, 60000);

  test('manual take one', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.create(resolve => {
        Sequence.instant()
          .read(data => resolve(data))
          .attachToRoot();
      }).attachToRoot();
      sequence.destroy();
    });
    // 0.2721000015735626
  }, 60000);
});
