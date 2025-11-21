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
      .tap(() => console.log('okay'))
      .attachToRoot();
    sequence.destroy();
  });

  test('sequence single read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.tap(() => {}).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // no attachable: 0.19089984893798828
    // queueMicrotask: 0.1549999713897705
    // read single changes: 0.15610003471374512
    // context functions: 0.14040040969848633
    // pending change: 0.14840030670166016
  }, 60000);

  test('sequence single map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.map(() => {}).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // no attachable: 0.19029998779296875
    // queueMicrotask: 0.15720009803771973
    // read single changes: 0.15710020065307617
    // context functions: 0.14049959182739258
    // pending change: 0.14980030059814453
  }, 60000);

  test('sequence single async map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.asyncMapDirect(() => Sequence.create(r2 => r2())).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // context functions: 0.7813000679016113
    // pending change: 0.738099992275238
  }, 60000);

  test('sequence single ordered map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.asyncMapOrdered(() => Sequence.create(r2 => r2())).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // queueMicrotask: 0.9242000579833984
    // 0.8559999465942383
    // read single changes: 0.7562999725341797
    // context functions: 0.7410998344421387
    // pending change: 0.7325997352600098
    // after bundle: 0.6985001564025879
  }, 60000);
});
