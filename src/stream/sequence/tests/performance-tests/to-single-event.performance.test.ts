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
      let sequence = Sequence.instant().toSingleEvent().attachToRoot();
      sequence.destroy();
    });
    // 0.20660001039505005
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
    // 0.26270000636577606
  }, 60000);

  test('with chaining', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant().toSingleEvent().chainToRoot();
      sequence.destroy();
    });

    // 0.3075000047683716
  }, 60000);
});
