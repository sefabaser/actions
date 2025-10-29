import { Wait } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
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
      let attachable = new Attachable().attachToRoot();
      attachable.onDestroy(() => {}).attachToRoot();
      attachable.destroy();
    });
    // Min:  0.6854000091552734
  }, 60000);

  test('action subscribe', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  0.9406000375747681
  }, 60000);

  test('action to sequence read', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action
        .toSequence()
        .read(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    // Min:  1.4560999870300293
  }, 60000);

  test('sequence single read', async () => {
    await testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new Attachable().attachToRoot();
      sequence.read(() => {}).attach(parent);
      resolve();
      parent.destroy();
    });
    // Min:  0.7418999671936035
  }, 60000);

  test('sequence 10x read and resolve', async () => {
    await testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new Attachable().attachToRoot();
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
    // Min: 2.4246000051498413 -> 2.3064000606536865
  }, 60000);

  test('sequence 10x map and resolve', async () => {
    await testPerformance(() => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r as any;
      });

      let parent = new Attachable().attachToRoot();
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
    // Min: 5.300999999046326
  }, 60000);
});
