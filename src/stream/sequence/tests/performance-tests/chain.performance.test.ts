import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Sequence as SequenceType } from '../../../../index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Sequence: typeof SequenceType;

  beforeEach(async () => {
    // @ts-ignore
    let imports = await import('../../../../../dist/index');
    Sequence = imports.Sequence as any;
  });

  test('unused sequence instant normal attach', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant();
      sequence.destroy();
    });
    // 0.09229999780654907
    // no attach: 0.0867999941110611
  }, 60000);

  test('unused sequence manual normal attach', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.create(resolve => resolve());
      sequence.destroy();
    });
    // 0.11140000075101852
    // no attach: 0.10039999336004257
  }, 60000);

  test('unused sequence instant with chain no read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant().chainToRoot();
      sequence.destroy();
    });
    // 0.23120000213384628
    // without pipeline: 0.19470000267028809
  }, 60000);

  test('unused sequence manual with chain no read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.create(resolve => resolve()).chainToRoot();
      sequence.destroy();
    });
    // 0.24880000203847885
    // without pipeline: 0.20570000261068344
  }, 60000);

  test('sequence instant with chain with read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .tap(() => {})
        .chainToRoot()
        .tap(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.37049999833106995
    // without pipeline: 0.32019999623298645
  }, 60000);

  test('sequence manual with chain with read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.create(resolve => resolve())
        .tap(() => {})
        .chainToRoot()
        .tap(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.38279999792575836
    // without pipeline: 0.3312999978661537 chain cost: ~0.1
  }, 60000);

  test('sequence instant', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .tap(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.27430009841918945
    // pending change: 0.14010000228881836
  }, 60000);

  test('chainingsequence instant', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .tap(() => {})
        .chainToRoot();
      sequence.destroy();
    });
    // 0.47679996490478516
    // manual destroy: 0.28600025177001953
    // without pipeline: 0.2443000003695488
  }, 60000);
});
