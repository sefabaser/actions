import { Wait } from 'helpers-lib';
import { describe, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { Action } from '../observables/action/action';

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

  test('subscribe', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.subscribe(() => {}).attach(parent);
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  0.9406000375747681
    Median:  1.1822000741958618
    */
  }, 60000);

  test('to sequence only', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.toSequence().attach(parent);
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  1.2843999862670898
    */
  }, 60000);

  test('to sequence and read', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action
        .toSequence()
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
      action.trigger();
      parent.destroy();
    });

    /*
    Min:  1.4880000352859497
    x10 read: 4.196700096130371 -> 3.6646000146865845
    */
  }, 60000);

  test('to sequence and map', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action
        .toSequence()
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
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  1.5273000001907349
    x10 map: 4.306399941444397 -> 4.249099969863892 -> 4.132699966430664
    */
  }, 60000);
});
