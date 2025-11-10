import { ArrayHelper, UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Sequence } from './sequence';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
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
    // Min:  0.7418999671936035
    // default attachable: 0.39929986000061035
    // no attachable: 0.19089984893798828
    // queueMicrotask: 0.1549999713897705
    // read single changes: 0.15610003471374512
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
    // Min:  0.8095998764038086
    // default attachable: 0.42039990425109863
    // no attachable: 0.19029998779296875
    // queueMicrotask: 0.15720009803771973
    // read single changes: 0.15710020065307617
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
    // 0.7476999759674072
    // read single changes: 0.6476001739501953
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
    // After introducing packages: 2.077700138092041
    // default attachable: 1.319700002670288
    // queueMicrotask: 0.9242000579833984
    // 0.8559999465942383
    // read single changes: 0.7562999725341797
  }, 60000);

  test('sequence 10x read and resolve', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .read(() => {})
        .attachToRoot();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      sequence.destroy();
    });
    // Min: 2.370800018310547
    // After introducing packages: 4.625699996948242 -> 5.069400072097778 -> 5.850499868392944
    // removing links: 5.253300189971924 -> 5.078900098800659 -> 4.990499973297119 -> 4.957599878311157 -> 4.654599905014038 -> 4.55460000038147
    // default attachable: 4.045099973678589
    // queueMicrotask: 3.5271999835968018
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
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      resolve();
      sequence.destroy();
    });
    // Min: 2.625300168991089
    // After introducing packages: 4.673799991607666 -> 5.293299913406372 -> 5.682100057601929 -> 7.014800071716309
    // After map asyncMapOrdered seperation: 6.359500169754028
    // removing links: 5.994100093841553
    // lazy pending packages: 5.787899971008301
    // remove .clear: 5.663399934768677
    // lazy on destroy listeners: 5.742200136184692
    // removing isPipelineEmpty: 5.639800071716309
    // fix lazy pending packages: 5.240200042724609
    // default attachable: 4.639800071716309
    // queueMicrotask: 4.099200010299683
  }, 60000);

  test('sequence 10x async map and resolve', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .asyncMapOrdered(() => Sequence.create(r2 => r2()))
        .attachToRoot();
      resolve();
      sequence.destroy();
    });
    // Min: 11.43939995765686
    // 10.742999792098999
    // read single changes: 9.607899904251099
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
    });
  }, 60000);
});
