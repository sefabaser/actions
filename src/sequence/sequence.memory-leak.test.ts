import { takeNodeMinimalHeap } from '@memlab/core';
import { Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from '../observables/action/action';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Sequence, SequenceClassNames, SequencePackageClassName } from './sequence';

describe.skipIf(process.env.QUICK)('Memory Leak', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  beforeEach(() => {
    delayedCalls.reset();
  });

  async function checkMemoryLeaks(destroyReferences: () => void = () => {}) {
    await delayedCalls.waitForAllPromises();

    let snapshot = await takeNodeMinimalHeap();
    if (snapshot.hasObjectWithClassName(SequencePackageClassName)) {
      throw new Error(SequencePackageClassName);
    }

    destroyReferences();
    snapshot = await takeNodeMinimalHeap();
    SequenceClassNames.forEach(name => {
      if (snapshot.hasObjectWithClassName(name)) {
        throw new Error(name);
      }
    });
  }

  describe('Single Sequence', () => {
    test('sequence chaining', async () => {
      let sequence = Sequence.create<string>(resolve => {
        delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .map(data =>
          Sequence.create<string>(resolve => {
            delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
          })
        )
        .attachToRoot();

      expect(sequence).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('destroying sequence in the middle of the chain', async () => {
      let sequence = Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value)))
        .take(2)
        .map(() => {})
        .attachToRoot();

      expect(sequence).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('dropping some packages', async () => {
      let sequence = Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value)))
        .filter(value => value !== 'c')
        .attachToRoot();

      expect(sequence).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('map chaining', async () => {
      let action1 = new Action<void>();
      let action2 = new Action<string>();

      let triggeredWith = '';
      let sequence = action1
        .toSequence()
        .map(() => action2)
        .map(data => data)
        .map(data => data)
        .map(data => {
          triggeredWith = data;
        })
        .attachToRoot();

      action1.trigger();
      await Wait();
      action2.trigger('a');

      expect(triggeredWith).toEqual('a');

      expect(sequence).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('sequence waiting for action to complete cut in the middle', async () => {
      let action = new Action<void>();

      let sequence = Sequence.create<void>(resolve => resolve())
        .map(() => action) // Action will never resolve
        .attachToRoot();

      sequence.destroy();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('sequence waiting for sequence to complete cut in the middle', async () => {
      let resolve!: () => void;

      let sequence = Sequence.create<void>(r1 => r1())
        .map(() =>
          // This sequence will never be resolved
          Sequence.create<void>(r2 => {
            resolve = r2;
          })
        )
        .attachToRoot();

      sequence.destroy();
      expect(resolve).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          resolve = undefined as any;
          sequence = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('sequence and action complex', async () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();
      let action3 = new Action<string>();

      let heap: string[] = [];
      let sequence = action1
        .map(a1 => action2.map(a2 => a1 + a2))
        .map(a2 =>
          Sequence.create<string>(resolve => {
            delayedCalls.callEachDelayed(['a', 'b', 'c'], s1 => resolve(a2 + s1));
          }).map(s2 => action3.map(d3 => s2 + d3))
        )
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['1', '2', '3'], value => {
        action1.trigger(value);
      });

      delayedCalls.callEachDelayed(['k', 'l', 'm'], value => {
        action2.trigger(value);
      });

      delayedCalls.callEachDelayed(['x', 'y', 'z', 'w'], value => {
        action3.trigger(value);
      });

      expect(sequence).toBeDefined();
      expect(
        checkMemoryLeaks(() => {
          sequence = undefined as any;
          action1 = undefined as any;
          action2 = undefined as any;
          action3 = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });

  describe('Multiple Sequences', () => {
    test('complex merge and combine destroyed by listener', async () => {
      let sequence1 = Sequence.create<number>(resolve => {
        delayedCalls.callEachDelayed([10, 11], delayedValue => resolve(delayedValue));
      }).map(value =>
        Sequence.create<string>(resolve => delayedCalls.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue)))
      );

      let sequence2 = Sequence.create<number>(resolve => {
        delayedCalls.callEachDelayed([20, 21], delayedValue => resolve(delayedValue));
      }).map(value => Sequence.create<string>(resolve => resolve(value + 's2')));

      let merged = Sequence.merge(sequence1, sequence2).map(value =>
        Sequence.create<string>(resolve => {
          delayedCalls.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      ); // 20s2m 10s1m 21s2m 11s1m

      let sequence3 = Sequence.create<string>(resolve => resolve('a')).map(value => value + 's3');
      let sequence4 = Sequence.create<string>(resolve => resolve('b')).map(value =>
        Sequence.create<string>(resolve => {
          delayedCalls.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue));
        })
      );

      let combined = Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      }).attachToRoot();

      await delayedCalls.waitForAllPromises();
      combined.destroy();

      expect(
        checkMemoryLeaks(() => {
          sequence1 = undefined as any;
          sequence2 = undefined as any;
          sequence3 = undefined as any;
          sequence4 = undefined as any;
          combined = undefined as any;
          merged = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('complex merge and combine destroyed in the middle of process', async () => {
      let sequence1 = Sequence.create<number>(resolve => {
        delayedCalls.callEachDelayed([10, 11], delayedValue => resolve(delayedValue));
      }).map(value =>
        Sequence.create<string>(resolve => delayedCalls.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue)))
      );

      let sequence2 = Sequence.create<number>(resolve => {
        delayedCalls.callEachDelayed([20, 21], delayedValue => resolve(delayedValue));
      }).map(value => Sequence.create<string>(resolve => resolve(value + 's2')));

      let merged = Sequence.merge(sequence1, sequence2).map(value =>
        Sequence.create<string>(resolve => {
          delayedCalls.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      );

      let sequence3 = Sequence.create<string>(resolve => resolve('a')).map(value => value + 's3');
      let sequence4 = Sequence.create<string>(resolve => resolve('b')).map(value =>
        Sequence.create<string>(resolve => {
          delayedCalls.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue));
        })
      );

      let combined = Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      }).attachToRoot();

      combined.destroy();

      expect(
        checkMemoryLeaks(() => {
          sequence1 = undefined as any;
          sequence2 = undefined as any;
          sequence3 = undefined as any;
          sequence4 = undefined as any;
          combined = undefined as any;
          merged = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('complex merge and combine destroyed by sequences', async () => {
      let sequence1 = Sequence.create<number>((resolve, executor) => {
        delayedCalls.callEachDelayed(
          [10, 11],
          delayedValue => resolve(delayedValue),
          () => executor.final()
        );
      }).map(value =>
        Sequence.create<string>((resolve, executor) =>
          delayedCalls.callEachDelayed(
            [value + 's1'],
            delayedValue => resolve(delayedValue),
            () => executor.final()
          )
        )
      );

      let sequence2 = Sequence.create<number>((resolve, executor) => {
        delayedCalls.callEachDelayed(
          [20, 21],
          delayedValue => resolve(delayedValue),
          () => executor.final()
        );
      }).map(value =>
        Sequence.create<string>((resolve, executor) => {
          resolve(value + 's2');
          executor.final();
        })
      );

      let merged = Sequence.merge(sequence1, sequence2).map(value =>
        Sequence.create<string>(resolve => {
          delayedCalls.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      );

      let sequence3 = Sequence.create<string>((resolve, executor) => {
        resolve('a');
        executor.final();
      }).map(value => value + 's3');
      let sequence4 = Sequence.create<string>((resolve, executor) => {
        resolve('b');
        executor.final();
      }).map(value =>
        Sequence.create<string>((resolve, executor) => {
          delayedCalls.callEachDelayed(
            [value + 's4'],
            delayedValue => resolve(delayedValue),
            () => executor.final()
          );
        })
      );

      let combined = Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      }).attachToRoot();

      await delayedCalls.waitForAllPromises();

      expect(combined.destroyed).toBeTruthy();

      expect(
        checkMemoryLeaks(() => {
          sequence1 = undefined as any;
          sequence2 = undefined as any;
          sequence3 = undefined as any;
          sequence4 = undefined as any;
          combined = undefined as any;
          merged = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('complex merge and combine instantly destroyed sequences', async () => {
      let sequence1 = Sequence.create<string>((resolve, executor) => {
        resolve('1');
        executor.final();
      }).map(value => value + '1');

      let sequence2 = Sequence.create<string>((resolve, executor) => {
        resolve('2');
        executor.final();
      }).map(value =>
        Sequence.create<string>((resolve, executor) => {
          resolve(value + '2');
          executor.final();
        })
      );

      let merged = Sequence.merge(sequence1, sequence2).map(value =>
        Sequence.create<string>((resolve, executor) => {
          resolve(value + 'm');
          executor.final();
        })
      );

      let sequence3 = Sequence.create<string>((resolve, executor) => {
        resolve('a');
        executor.final();
      }).map(value => value + 's3');

      let heap: unknown[] = [];
      let combined = Sequence.combine({
        s3: sequence3,
        m: merged
      })
        .read(value => heap.push(value))
        .attachToRoot();

      expect(heap).toEqual([
        {
          m: '11m',
          s3: 'as3'
        },
        {
          m: '22m',
          s3: 'as3'
        }
      ]);
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
      expect(sequence3.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(combined.destroyed).toBeTruthy();

      expect(
        checkMemoryLeaks(() => {
          sequence1 = undefined as any;
          sequence2 = undefined as any;
          sequence3 = undefined as any;
          merged = undefined as any;
          combined = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });
});
