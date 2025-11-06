import { ArrayHelper } from 'helpers-lib';
import { describe, test } from 'vitest';

import { IDAttachable } from '../attachable/id-attachable';
import { Action } from '../observables/action/action';
import { PerformanceUnitTestHelper } from './performance-unit-test.helper';
import { Sequence } from './sequence';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  test('onDestroy callback', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let attachable = new IDAttachable().attachToRoot();
      attachable.onDestroy(() => {}).attachToRoot();
      attachable.destroy();
    });
    // Min:  0.6854000091552734
  }, 60000);

  test('action subscribe single', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.9406000375747681 -> 0.8449001312255859
  }, 60000);

  test('action to sequence read', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action
        .toSequence()
        .read(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  1.2650001049041748 -> 1.1787998676300049
  }, 60000);

  test('sequence single read', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
      sequence.read(() => {}).attach(parent);
      resolve();
      parent.destroy();
    });
    // Min:  0.7418999671936035
  }, 60000);

  test('sequence single map', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
      sequence.map(() => {}).attach(parent);
      resolve();
      parent.destroy();
    });
    // Min:  0.8095998764038086
  }, 60000);

  test('sequence single async map', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
      sequence.orderedMap(() => Sequence.create(r2 => r2())).attach(parent);
      resolve();
      parent.destroy();
    });
    // Min:  1.1162998676300049
    // After introducing packages: 2.077700138092041
  }, 60000);

  test('action subscribe 10x', async () => {
    let action = new Action<void>();
    await PerformanceUnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      action.trigger();
      parent.destroy();
    });
    // Min:  8.138400077819824
  }, 60000);

  test('sequence 10x read and resolve', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
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
        .attach(parent);
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
      parent.destroy();
    });
    // Min: 2.370800018310547
    // After introducing packages: 4.625699996948242 -> 5.069400072097778 -> 5.850499868392944
  }, 60000);

  test('sequence 10x map and resolve', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
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
        .attach(parent);
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
      parent.destroy();
    });
    // Min: 2.625300168991089
    // After introducing packages: 4.673799991607666 -> 5.293299913406372 -> 5.682100057601929 -> 7.014800071716309
    // After map orderedMap seperation: 6.359500169754028
  }, 60000);

  test('sequence 10x async map and resolve', async () => {
    await PerformanceUnitTestHelper.testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        let parent = new IDAttachable().attachToRoot();
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
          .attach(parent);
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
        parent.destroy();
      },
      { sampleCount: 10, repetationPerSample: 1000 }
    );
    // Min: 101.85249996185303
    // After introducing packages: 223.7542998790741
  }, 60000);

  test('combine new object', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
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
    });
  }, 60000);

  test('combine new array', async () => {
    await PerformanceUnitTestHelper.testPerformance(() => {
      let combination = Sequence.combine(
        ArrayHelper.createEmptyArray(10).map(() => Sequence.create<string>(resolve => resolve('a')))
      )
        .read(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  12.509200096130371
    });
  }, 60000);
});
