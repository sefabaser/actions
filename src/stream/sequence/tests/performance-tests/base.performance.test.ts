import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Sequence as SequenceType } from '../../../../index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Sequence: typeof SequenceType;

  beforeEach(async () => {
    let imports = await import('../../../../../dist/index');
    Sequence = imports.Sequence as any;
  });

  test('build test', async () => {
    let sequence = Sequence.instant()
      .tap(() => console.info('okay'))
      .attachToRoot();
    sequence.destroy();
  });

  test('sequence instant single read', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let sequence = Sequence.instant()
          .tap(() => {})
          .attachToRoot();
        sequence.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 1.1929001808166504
  }, 60000);

  test('sequence single resolve directly read', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let sequence = Sequence.create(resolve => resolve())
          .tap(() => {})
          .attachToRoot();
        sequence.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 2.3292999267578125
  }, 60000);

  test('sequence single resolve later read', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        })
          .tap(() => {})
          .attachToRoot();
        resolve();
        sequence.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 2.2720000743865967
  }, 60000);

  test('sequence single map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        sequence.map(() => {}).attachToRoot();
        resolve();
        sequence.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 2.707899808883667
  }, 60000);

  test('sequence single async map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        sequence.asyncMapDirect(() => Sequence.create(r2 => r2())).attachToRoot();
        resolve();
        sequence.destroy();
      },
      { sampleCount: 100, repetationCount: 10000 }
    );
    // 14.470700025558472
  }, 60000);

  test('sequence single ordered map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        sequence.asyncMapOrdered(() => Sequence.create(r2 => r2())).attachToRoot();
        resolve();
        sequence.destroy();
      },
      { sampleCount: 100, repetationCount: 10000 }
    );
    // 20.438699960708618
  }, 60000);
});
