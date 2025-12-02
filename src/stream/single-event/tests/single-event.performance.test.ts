import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Attachable as AttachableType, SingleEvent as SingleEventType, Variable as VariableType } from '../../../index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let SingleEvent: typeof SingleEventType;
  let Variable: typeof VariableType;
  let Attachable: typeof AttachableType;

  beforeEach(async () => {
    let imports = await import('../../../../dist/index');
    SingleEvent = imports.SingleEvent as any;
    Variable = imports.Variable as any;
    Attachable = imports.Attachable as any;
  });

  test('build test', async () => {
    let a = new Attachable().attachToRoot();
    let sequence = SingleEvent.instant()
      .tap(() => console.info('okay'))
      .attach(a);
    sequence.destroy();
  });

  test('instant single event', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.instant()
          .tap(() => {})
          .attachToRoot();

        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // sequence to singleEvent: 0.14010000228881836 -> 0.1370997428894043
    // singleEvent: 0.13450002670288086

    // after: repetationCount: 10000
    // 1.073199987411499
  }, 60000);

  test('chaining instant single event', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.instant()
          .tap(() => {})
          .chainToRoot();

        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // sequence to singleEvent: 0.28600025177001953 -> 0.2734999656677246
    // 0.2734999656677246
    // after no pipeline: 0.24059999734163284

    // after: repetationCount: 10000
    // 1.9372000694274902
  }, 60000);

  test('custom chaining instant single event', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.create(resolve => {
          SingleEvent.instant()
            .tap(() => resolve())
            .attachToRoot();
        });

        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 0.25729990005493164 no significant performance increase

    // after: repetationCount: 10000
    // 2.3704001903533936
  }, 60000);

  test('instant triggered multiple reads', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.instant()
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .attachToRoot();
        singleEvent.destroy();
      },
      { sampleCount: 100, repetationCount: 10000 }
    );
    // sequence to singleEvent: 1.9693999290466309 -> 1.5454998016357422
    // 1.5454998016357422

    // after: repetationCount: 10000
    // 29.101799964904785
  }, 60000);

  test('single read', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let singleEvent = SingleEvent.create(r => {
          resolve = r as any;
        })
          .tap(() => {})
          .attachToRoot();

        resolve();
        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // sequence to singleEvent: 0.14840030670166016 -> 0.14529991149902344
    // singleEvent: 0.1549999713897705
    // 0.1466999053955078
    // arrow function resolve: 0.14529991149902344

    // after: repetationCount: 10000
    // 1.1806998252868652
  }, 60000);

  test('single event single map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let singleEvent = SingleEvent.create(r => {
          resolve = r as any;
        });

        singleEvent.map(() => {}).attachToRoot();
        resolve();
        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // sequence to singleEvent: 0.14980030059814453 -> 0.1482996940612793
    // singleEvent: 0.15720009803771973
    // 0.14890003204345703
    // arrow function resolve: 0.1482996940612793

    // after: repetationCount: 10000
    // 1.2209999561309814
  }, 60000);

  test('single event single async map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let singleEvent = SingleEvent.create(r => {
          resolve = r as any;
        });

        singleEvent.asyncMap(() => SingleEvent.create(r2 => r2())).attachToRoot();
        resolve();
        singleEvent.destroy();
      },
      { sampleCount: 200, repetationCount: 10000 }
    );
    // sequence to singleEvent: 0.7420997619628906 -> 0.5767998695373535
    // singleEvent: 0.9242000579833984
    // 0.4514000415802002
    // 0.42370009422302246
    // arrow function resolve: 0.411099910736084
    // 0.5767998695373535

    // after: repetationCount: 10000
    // 11.912199974060059
  }, 60000);

  test('single event 10x read', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .tap(() => {})
          .attachToRoot();
        singleEvent.destroy();
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 0.6243000030517578 -> 0.42190027236938477
    // 0.511199951171875
    // arrow function resolve: 0.42190027236938477

    // after: repetationCount: 10000
    // 10.219599962234497
  }, 60000);

  test('single event 10x map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.create(resolve => resolve())
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
        singleEvent.destroy();
      },
      { sampleCount: 200, repetationCount: 10000 }
    );
    // 0.5051000118255615
    // arrow function resolve: 0.43959999084472656

    // after: repetationCount: 10000
    // 10.644100189208984
  }, 60000);

  test('single event 10x async map', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        let singleEvent = SingleEvent.create(resolve => resolve())
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .asyncMap(() => SingleEvent.create(r2 => r2()))
          .attachToRoot();
        singleEvent.destroy();
      },
      { sampleCount: 100, repetationCount: 10000 }
    );
    // 5.396200180053711
    // 5.273400068283081

    // after: repetationCount: 10000
    // 109.3420000076294
  }, 60000);

  test('destroyed by attachable', async () => {
    let variable = new Variable<number>(0);

    await UnitTestHelper.testPerformance(
      () => {
        SingleEvent.create(resolve => resolve())
          .asyncMap((_, context) => {
            return SingleEvent.create(resolve => {
              variable.subscribe(() => resolve()).attach(context.attachable);
            });
          })
          .attachToRoot();
      },
      { sampleCount: 200, repetationCount: 10000 }
    );
    // 0.8601999282836914
    // 0.8238000869750977
    // read single changes: 0.8571000099182129

    // after: repetationCount: 10000
    // 17.02150011062622
  }, 60000);

  test('single event promise comparison', async () => {
    await UnitTestHelper.testPerformance(
      () => {
        return new Promise<void>(resolve => resolve());
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // base cost: 0.06969976425170898
    // after: repetationCount: 10000
    // 0.6658999919891357

    await UnitTestHelper.testPerformance(
      () => {
        return new Promise<void>(resolve => {
          return new Promise<void>(r => r()).then(() => {
            resolve();
          });
        });
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // 0.13959980010986328 - base = 0.0699000358581543
    // after: repetationCount: 10000
    // 1.7618000507354736

    await UnitTestHelper.testPerformance(
      () => {
        return new Promise<void>(resolve => {
          let singleEvent = SingleEvent.instant()
            .tap(() => resolve())
            .attachToRoot();

          singleEvent.destroy();
        });
      },
      { sampleCount: 500, repetationCount: 10000 }
    );
    // singleEvent: 0.28189992904663086 - base = 0.21220016479492188
    // after: repetationCount: 10000
    // 2.2676000595092773

    // promise is ~22% more efficient
  }, 60000);
});
