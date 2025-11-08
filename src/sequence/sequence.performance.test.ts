import { ArrayHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { UnitTestHelper } from './delayed-sequential-calls.helper';
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
  }, 60000);

  test('sequence single async map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      sequence.orderedMap(() => Sequence.create(r2 => r2())).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // Min:  1.1162998676300049
    // After introducing packages: 2.077700138092041
    // default attachable: 1.319700002670288
    // no attachable:
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
    // no attachable:
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
    // After map orderedMap seperation: 6.359500169754028
    // removing links: 5.994100093841553
    // lazy pending packages: 5.787899971008301
    // remove .clear: 5.663399934768677
    // lazy on destroy listeners: 5.742200136184692
    // removing isPipelineEmpty: 5.639800071716309
    // fix lazy pending packages: 5.240200042724609
    // default attachable: 4.639800071716309
    // no attachable:
  }, 60000);

  test('sequence 10x async map and resolve', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        sequence
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
          .orderedMap(() => Sequence.create(r2 => r2()))
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
      },
      { sampleCount: 50, repetationPerSample: 1000 }
    );
    // Min: 101.85249996185303
    // After introducing packages: 223.7542998790741
    // removing links: 230.xxx -> 203.4695999622345
    // lazy on destroy listeners: 184.33080005645752
    // no attachable:
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
      // Min:  13.876399993896484 -> 12.01830005645752 -> 11.235599994659424
      // default attachable: 11.232700109481812
      // no attachable:
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
      // no attachable:
    });
  }, 60000);
});
