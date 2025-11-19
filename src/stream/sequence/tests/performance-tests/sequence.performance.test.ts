import { ArrayHelper, UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Sequence } from '../../../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('build test', async () => {
    let sequence = Sequence.instant()
      .read(() => console.log('okay'))
      .attachToRoot();
    sequence.destroy();
  });

  /*
  test('take one', async () => {
    // await UnitTestHelper.testPerformance(() => {
    let sequence = Sequence.instant('a', 'b', 'c')
      .takeOne()
      .read(() => {
        console.log('ok');
      })
      .attachToRoot();
    sequence.destroy();
    // });
    // 0.47679996490478516
    // manual destroy: 0.28600025177001953
  }, 60000);*/

  test('sequence single read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.read(() => {}).attachToRoot();
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

  test('combine new object', async () => {
    await UnitTestHelper.testPerformance(() => {
      let combination = Sequence.combine(
        ArrayHelper.createIntegerArray(10).reduce((acc, i) => {
          acc[i] = Sequence.create<string>(resolve => resolve('a'));
          return acc;
        }, {})
      )
        .read(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  13.876399993896484
      // default attachable: 11.232700109481812
      // queueMicrotask: 10.21969985961914
      // read single changes: 10.207499980926514
      // context functions: 9.99370002746582
      // pending change: 8.077600002288818
    });
  }, 60000);

  test('combine new array', async () => {
    await UnitTestHelper.testPerformance(() => {
      let combination = Sequence.combine(
        ArrayHelper.createEmptyArray(10).map(() => Sequence.create<string>(resolve => resolve('a')))
      )
        .read(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  12.509200096130371
      // default attachable: 11.661400079727173
      // queueMicrotask: 9.956599950790405
      // 9.698499917984009
      // read single changes: 9.804400205612183
      // context functions: 9.666399955749512
      // pending change: 8.014800071716309
    });
  }, 60000);
});
