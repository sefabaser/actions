import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Sequence as SequenceType, SingleEvent as SingleEventType } from './index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Sequence: typeof SequenceType;
  let SingleEvent: typeof SingleEventType;

  beforeEach(async () => {
    let imports = await import('../dist/index');
    Sequence = imports.Sequence as any;
    SingleEvent = imports.SingleEvent as any;
  });

  test('lib test', async () => {
    let sequence = Sequence.instant()
      .read(() => {
        console.log('a');
      })
      .attachToRoot();

    sequence.destroy();
  }, 60000);

  test('instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.instant()
        .read(() => {})
        .attachToRoot();

      sequence.destroy();
    });
    // sequence: 0.14750003814697266
  }, 60000);

  test('sequence instant', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .read(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.12080001831054688
  }, 60000);

  test('single event 10x map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.create(resolve => resolve())
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.43809986114501953
  }, 60000);

  test('sequence 10x map and resolve', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();
      resolve();
      sequence.destroy();
    });
    // 0.5514998435974121
  }, 60000);
});
