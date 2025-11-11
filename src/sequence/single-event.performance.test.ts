import { UnitTestHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Variable } from '../observables/variable/variable';
import { SingleEvent } from './single-event';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('single read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = SingleEvent.create(r => {
        resolve = r as any;
      })
        .read(() => {})
        .attachToRoot();

      resolve();
      sequence.destroy();
    });
    // sequence: 0.1549999713897705
    // 0.1466999053955078
    // arrow function resolve: 0.14529991149902344
  }, 60000);

  test('sequence single map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = SingleEvent.create(r => {
        resolve = r as any;
      });

      sequence.map(() => {}).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // sequence: 0.15720009803771973
    // 0.14890003204345703
    // arrow function resolve: 0.1482996940612793
  }, 60000);

  test('sequence single async map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = SingleEvent.create(r => {
        resolve = r as any;
      });

      sequence.asyncMap(() => SingleEvent.create(r2 => r2())).attachToRoot();
      resolve();
      sequence.destroy();
    });
    // sequence: 0.9242000579833984
    // 0.4514000415802002
    // 0.42370009422302246
    // arrow function resolve: 0.411099910736084
  }, 60000);

  test('sequence 10x read', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.create(resolve => resolve())
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
    // 0.511199951171875
    // arrow function resolve: 0.42190027236938477
  }, 60000);

  test('sequence 10x map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.create(resolve => resolve())
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
      sequence.destroy();
    });
    // 0.5051000118255615
    // arrow function resolve: 0.43959999084472656
  }, 60000);

  test('sequence 10x async map', async () => {
    await UnitTestHelper.testPerformance(() => {
      let sequence = SingleEvent.create(resolve => resolve())
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
      sequence.destroy();
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
