import { ArrayHelper, UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Sequence } from './sequence';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('sequence instant', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .read(() => {})
        .map(() => {})
        .attachToRoot();
      sequence.destroy();
    });
    // 0.27430009841918945
    // pending change: 0.14389991760253906
  }, 60000);

  test('chainingsequence instant', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = Sequence.instant()
        .read(() => {})
        .chainToRoot();
      sequence.destroy();
    });
    // 0.47679996490478516
    // manual destroy: 0.28600025177001953
  }, 60000);

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
    // pending change: 0.7420997619628906
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
    // After introducing packages: 5.850499868392944
    // removing links: 5.253300189971924 -> 5.078900098800659 -> 4.990499973297119 -> 4.957599878311157 -> 4.654599905014038 -> 4.55460000038147
    // default attachable: 4.045099973678589
    // queueMicrotask: 3.5271999835968018
    // context functions: 2.7063002586364746
    // pending change: 2.5808000564575195
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
    // context functions: 9.31029987335205
    // pending change: 8.045899868011475
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
