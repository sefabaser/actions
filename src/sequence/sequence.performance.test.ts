import { describe, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { Action } from '../observables/action/action';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let testPerformance = async (callback: () => void) => {
    let start: number;
    let end: number;
    let durations: number[] = [];

    for (let v = 0; v < 1000; v++) {
      start = performance.now();
      for (let i = 0; i < 1000; i++) {
        callback();
      }
      end = performance.now();
      durations.push(end - start);
    }

    durations = durations.sort((a, b) => a - b);
    let min = durations[0];
    let median = durations[Math.floor(durations.length / 2)];

    let limit = median * 2;
    let filteredDurations = durations.filter(duration => duration < limit);
    let filteredAverage = filteredDurations.reduce((acc, item) => acc + item) / filteredDurations.length;

    console.log('Min: ', min);
    console.log('Median: ', median);
    console.log('Filtered Average:', filteredAverage);
  };

  test('only callback', async () => {
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
    Filtered Average: 1.1823088247694222
    */
  }, 60000);

  test('to sequence no read', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action.toSequence().attach(parent);
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  1.2843999862670898
    Median:  1.529900074005127
    Filtered Average: 1.548494506297738
    */
  }, 60000);

  test('to sequence and read', async () => {
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

    /*
    Min:  1.5024000406265259
    Median:  1.7849000692367554
    Filtered Average: 1.7647931434032393
    */
  }, 60000);

  test('to sequence and map', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action
        .toSequence()
        .map(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  1.5488998889923096
    Median:  1.8035000562667847
    Filtered Average: 1.8047754973218502
    */
  }, 60000);

  test('to sequence and two map', async () => {
    let action = new Action<void>();
    await testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      action
        .toSequence()
        .map(() => {})
        .map(() => {})
        .attach(parent);
      action.trigger();
      parent.destroy();
    });
    /*
    Min:  1.9982999563217163
    Median:  2.433799982070923
    Filtered Average: 2.324442684235058
    */
  }, 60000);

  test('performance test', async () => {
    /*
    only subscribe 20.99048124998808
    to sequence and read 50.95177083462477
    to sequence and map 105.322464607656
    */
    // only subscribe: 12.471512511372566
    // to sequence: 41.929049998521805
    // with read: 99.9572375267744
    // two read: 131.3105124682188
    // three read: 177.66362500190735
    // to sequence no destroy: 30.146337494254112
    // with read no destroy: 42.59712500870228
    // two read no destroy:60.496975004673004
    // three read no destroy: 65.87644998729229
  });
});
