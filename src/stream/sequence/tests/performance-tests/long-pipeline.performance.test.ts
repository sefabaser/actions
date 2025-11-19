import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Sequence } from '../../../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('instant triggered multiple reads', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
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
      sequence.destroy();
    });
    // 4.466700077056885
    // pending until attached: 2.0001001358032227
    // taking as args: 1.9693999290466309
  }, 60000);

  test('sequence 10x read and resolve after attach', async () => {
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
    // After introducing packages: 5.850499868392944
    // removing links: 5.253300189971924 -> 5.078900098800659 -> 4.990499973297119 -> 4.957599878311157 -> 4.654599905014038 -> 4.55460000038147
    // default attachable: 4.045099973678589
    // queueMicrotask: 3.5271999835968018
    // context functions: 2.7063002586364746
    // pending change: 2.5808000564575195
    // after bundle: 2.5227999687194824
  }, 60000);

  test('sequence 10x read and resolve before attach', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.create(resolve => {
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
      sequence.destroy();
    });
    // 2.576399803161621
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
    // After introducing packages: 7.014800071716309
    // After map asyncMapOrdered seperation: 6.359500169754028
    // removing links: 5.994100093841553
    // lazy pending packages: 5.787899971008301
    // remove .clear: 5.663399934768677
    // lazy on destroy listeners: 5.742200136184692
    // removing isPipelineEmpty: 5.639800071716309
    // fix lazy pending packages: 5.240200042724609
    // default attachable: 4.639800071716309
    // queueMicrotask: 4.099200010299683
    // context functions: 2.909599781036377
    // pending change: 2.8305001258850098
  }, 60000);

  test('sequence 10x async map', async () => {
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
    // context functions: 9.31029987335205
    // pending change: 8.045899868011475
    // after bundle: 7.693600177764893
  }, 60000);
});
