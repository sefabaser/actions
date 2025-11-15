import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { SingleEvent, Variable } from '../../../../dist/index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('promise', async () => {
    await UnitTestHelper.testPerformance(() => {
      new Promise<void>(resolve => {
        resolve();
      }).then(() => {});
    });
    // singleEvent: 0.03639984130859375
  }, 60000);

  test('instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.instant()
        .read(() => {})
        .attachToRoot();

      singleEvent.destroy();
    });
    // singleEvent: 0.1370997428894043
  }, 60000);

  test('chaining instant single event', async () => {
    await UnitTestHelper.testPerformance(() => {
      let singleEvent = SingleEvent.instant()
        .read(() => {})
        .chainToRoot();

      singleEvent.destroy();
    });
    // 0.2734999656677246
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
    // 0.25729990005493164
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
    // 1.5506997108459473
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
    // singleEvent: 0.9242000579833984
    // 0.4514000415802002
    // 0.42370009422302246
    // arrow function resolve: 0.411099910736084
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
});
