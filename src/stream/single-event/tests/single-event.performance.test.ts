import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { SingleEvent, Variable } from '../../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('build test', async () => {
    let sequence = SingleEvent.instant()
      .read(() => console.log('okay'))
      .attachToRoot();
    sequence.destroy();
  });

  test('instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.instant()
        .read(() => {})
        .attachToRoot();

      singleEvent.destroy();
    });
    // sequence to singleEvent: 0.14010000228881836 -> 0.1370997428894043
    // singleEvent: 0.1370997428894043
  }, 60000);

  test('chaining instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.instant()
        .read(() => {})
        .chainToRoot();

      singleEvent.destroy();
    });
    // sequence to singleEvent: 0.28600025177001953 -> 0.2734999656677246
    // 0.2734999656677246
    // after no pipeline: 0.24059999734163284
  }, 60000);

  test('custom chaining instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.create(resolve => {
        SingleEvent.instant()
          .read(() => resolve())
          .attachToRoot();
      });

      singleEvent.destroy();
    });
    // 0.25729990005493164 no significant performance increase
  }, 60000);

  test('instant triggered multiple reads', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.instant()
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
      singleEvent.destroy();
    });
    // sequence to singleEvent: 1.9693999290466309 -> 1.5454998016357422
    // 1.5454998016357422
  }, 60000);

  test('single read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let singleEvent = SingleEvent.create(r => {
        resolve = r as any;
      })
        .read(() => {})
        .attachToRoot();

      resolve();
      singleEvent.destroy();
    });
    // sequence to singleEvent: 0.14840030670166016 -> 0.14529991149902344
    // singleEvent: 0.1549999713897705
    // 0.1466999053955078
    // arrow function resolve: 0.14529991149902344
  }, 60000);

  test('single event single map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let singleEvent = SingleEvent.create(r => {
        resolve = r as any;
      });

      singleEvent.map(() => {}).attachToRoot();
      resolve();
      singleEvent.destroy();
    });
    // sequence to singleEvent: 0.14980030059814453 -> 0.1482996940612793
    // singleEvent: 0.15720009803771973
    // 0.14890003204345703
    // arrow function resolve: 0.1482996940612793
  }, 60000);

  test('single event single async map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let singleEvent = SingleEvent.create(r => {
        resolve = r as any;
      });

      singleEvent.asyncMap(() => SingleEvent.create(r2 => r2())).attachToRoot();
      resolve();
      singleEvent.destroy();
    });
    // sequence to singleEvent: 0.7420997619628906 -> 0.5767998695373535
    // singleEvent: 0.9242000579833984
    // 0.4514000415802002
    // 0.42370009422302246
    // arrow function resolve: 0.411099910736084
    // 0.5767998695373535
  }, 60000);

  test('single event 10x read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.create(resolve => resolve())
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
      singleEvent.destroy();
    });
    // 0.6243000030517578 -> 0.42190027236938477
    // 0.511199951171875
    // arrow function resolve: 0.42190027236938477
  }, 60000);

  test('single event 10x map', async () => {
    await UnitTestHelper.testPerformance(() => {
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
    });
    // 0.5051000118255615
    // arrow function resolve: 0.43959999084472656
  }, 60000);

  test('single event 10x async map', async () => {
    await UnitTestHelper.testPerformance(() => {
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
    });
    // 5.396200180053711
    // 5.273400068283081
  }, 60000);

  test('destroyed by attachable', async () => {
    let variable = new Variable<number>(0);

    await UnitTestHelper.testPerformance(() => {
      SingleEvent.create(resolve => resolve())
        .asyncMap((_, context) => {
          return SingleEvent.create(resolve => {
            variable.subscribe(() => resolve()).attach(context.attachable);
          });
        })
        .attachToRoot();
    });
    // 0.8601999282836914
    // 0.8238000869750977
    // read single changes: 0.8571000099182129
  }, 60000);

  test('single event promise comparison', async () => {
    await UnitTestHelper.testPerformance(() => {
      return new Promise<void>(resolve => resolve());
    });
    // base cost: 0.06969976425170898

    await UnitTestHelper.testPerformance(() => {
      return new Promise<void>(resolve => {
        return new Promise<void>(r => r()).then(() => {
          resolve();
        });
      });
    });
    // 0.13959980010986328 - base = 0.0699000358581543

    await UnitTestHelper.testPerformance(() => {
      return new Promise<void>(resolve => {
        let singleEvent = SingleEvent.instant()
          .read(() => resolve())
          .attachToRoot();

        singleEvent.destroy();
      });
    });
    // singleEvent: 0.28189992904663086 - base = 0.21220016479492188

    // promise is ~3x more efficient
  }, 60000);
});
