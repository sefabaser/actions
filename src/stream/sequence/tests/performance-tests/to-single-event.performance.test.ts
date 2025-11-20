import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Sequence as SequenceType, SingleEvent as SingleEventType } from '../../../../index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Sequence: typeof SequenceType;
  let SingleEvent: typeof SingleEventType;

  beforeEach(async () => {
    let imports = await import('../../../../../dist/index');
    Sequence = imports.Sequence as any;
    SingleEvent = imports.SingleEvent as any;
  });

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

  test('with single chaining', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant().singleChainToRoot();
      sequence.destroy();
    });

    // 0.21230000257492065
  }, 60000);
});
