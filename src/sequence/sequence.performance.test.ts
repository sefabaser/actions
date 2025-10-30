import { Wait } from 'helpers-lib';
import { describe, test } from 'vitest';

import { IDAttachable } from '../attachable/id-attachable';
import { Action } from '../observables/action/action';
import { Sequence } from './sequence';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let testPerformance = async (
    callback: () => void,
    options: {
      sampleCount: number;
      repetationPerSample: number;
    } = { sampleCount: 500, repetationPerSample: 1000 }
  ) => {
    let start: number;
    let end: number;
    let durations: number[] = [];

    for (let v = 0; v < options.sampleCount; v++) {
      start = performance.now();
      for (let i = 0; i < options.repetationPerSample; i++) {
        callback();
      }
      end = performance.now();
      durations.push(end - start);

      await Wait();
      global.gc?.();
      await Wait();
    }

    durations = durations.sort((a, b) => a - b);
    let min = durations[0];
    let median = durations[Math.floor(durations.length / 2)];

    console.log('Min: ', min);
    console.log('Median: ', median);
  };

  test('onDestroy callback', async () => {
    await testPerformance(() => {
      let attachable = new IDAttachable().attachToRoot();
      attachable.onDestroy(() => {}).attachToRoot();
      attachable.destroy();
    });
    // Min:  0.6854000091552734
  }, 60000);

  test('action subscribe', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.9406000375747681
  }, 60000);

  test('action to sequence read', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      action
        .toSequence()
        .read(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  1.2650001049041748
  }, 60000);

  test('sequence single read', async () => {
    await testPerformance(() => {
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
    await testPerformance(() => {
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
    await testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new IDAttachable().attachToRoot();
      sequence.map(() => Sequence.create(resolve => resolve())).attach(parent);
      resolve();
      parent.destroy();
    });
    // Min:  1.1162998676300049
  }, 60000);

  test('sequence 10x read and resolve', async () => {
    await testPerformance(() => {
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
    // Min: 2.4227001667022705
  }, 60000);

  test('sequence 10x map and resolve', async () => {
    await testPerformance(() => {
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
    // Min: 2.725099802017212
  }, 60000);

  test('sequence 10x async map and resolve', async () => {
    await testPerformance(
      () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r as any;
        });

        let parent = new IDAttachable().attachToRoot();
        sequence
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
          .map(() => Sequence.create(resolve => resolve()))
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
  }, 60000);
});
