import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from '../../observables/action/action';
import { Sequence } from '../../stream/sequence/sequence';
import { ActionLib } from '../action-lib';

describe('Sequence', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Sample Operations', () => {
    test('wait until any of it completed', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      let sequence = ActionLib.merge(action1, action2)
        .take(1)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action1.trigger('a');
      expect(heap).toEqual(['a']);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);

      action2.trigger('b');
      expect(heap).toEqual(['a']);
    });

    test('wait until all completed', () => {
      let action1 = new Action<void>();
      let action2 = new Action<void>();

      let callCount = 0;

      let sequence = ActionLib.combine({ a: action1, b: action2 })
        .take(1)
        .tap(() => callCount++)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action1.trigger();
      action1.trigger();
      expect(callCount).toEqual(0);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action2.trigger();
      action2.trigger();
      expect(callCount).toEqual(1);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });

    test('wait until next', () => {
      let action = new Action<void>();

      let triggerCount = 0;
      let singleEvent = action
        .toSingleEvent()
        .tap(() => triggerCount++)
        .attachToRoot();

      expect(triggerCount).toEqual(0);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger();
      expect(triggerCount).toEqual(1);
      expect(singleEvent.destroyed).toBeTruthy();

      action.trigger();
      expect(triggerCount).toEqual(1);
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('wait until', () => {
      let action = new Action<string>();

      let heap: unknown[] = [];
      let singleEvent = action
        .filter(value => value === 'yes')
        .toSingleEvent()
        .tap(value => heap.push(value))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger('not');
      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger('yes');
      expect(heap).toEqual(['yes']);
      expect(singleEvent.destroyed).toBeTruthy();

      action.trigger('not');
      action.trigger('yes');
      action.trigger('not');
      action.trigger('yes');
      expect(heap).toEqual(['yes']);
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Combinations', () => {
    test('sequence and action', async () => {
      let action = new Action<string>();

      let heap: string[] = [];
      action
        .asyncMapOrdered(data =>
          Sequence.create<string>(resolve => {
            UnitTestHelper.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
          })
        )
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      UnitTestHelper.callEachDelayed(['1', '2', '3'], value => {
        action.trigger(value);
      });

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1a', '2a', '3a']);
    });

    test('complex merge and combine destroy after all complete', async () => {
      let sequence1 = Sequence.create<number>(resolve => {
        UnitTestHelper.callEachDelayed([10, 11], delayedValue => resolve(delayedValue));
      }).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue)))
      );

      let sequence2 = Sequence.create<number>(resolve => {
        UnitTestHelper.callEachDelayed([20, 21], delayedValue => resolve(delayedValue));
      }).asyncMapOrdered(value => Sequence.create<string>(resolve => resolve(value + 's2')));

      let merged = ActionLib.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      ); // 20s2m 10s1m 21s2m 11s1m

      let sequence3 = Sequence.create<string>(resolve => resolve('a')).map(value => value + 's3');
      let sequence4 = Sequence.create<string>(resolve => resolve('b')).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue));
        })
      );

      let heap: unknown[] = [];
      let combined = ActionLib.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([
        {
          m: '20s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '10s1m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '21s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '11s1m',
          s3: 'as3',
          s4: 'bs4'
        }
      ]);

      combined.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
      expect(sequence3.destroyed).toBeTruthy();
      expect(sequence4.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(combined.destroyed).toBeTruthy();
    });

    test('complex merge and combine destroyed by sequences', async () => {
      let sequence1 = Sequence.create<number>((resolve, context) => {
        UnitTestHelper.callEachDelayed([10, 11], delayedValue => resolve(delayedValue), {
          allDone: () => context.final()
        });
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) =>
          UnitTestHelper.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue), {
            allDone: () => context.final()
          })
        )
      );

      let sequence2 = Sequence.create<number>((resolve, context) => {
        UnitTestHelper.callEachDelayed([20, 21], delayedValue => resolve(delayedValue), { allDone: () => context.final() });
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + 's2');
          context.final();
        })
      );

      let merged = ActionLib.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      );

      let sequence3 = Sequence.create<string>((resolve, context) => {
        resolve('a');
        context.final();
      }).map(value => value + 's3');
      let sequence4 = Sequence.create<string>((resolve, context) => {
        resolve('b');
        context.final();
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          UnitTestHelper.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue), {
            allDone: () => context.final()
          });
        })
      );

      let heap: unknown[] = [];
      ActionLib.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual([
        {
          m: '20s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '10s1m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '21s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '11s1m',
          s3: 'as3',
          s4: 'bs4'
        }
      ]);
    });

    test('complex merge and combine instantly finalized sequences', async () => {
      let sequence1 = Sequence.create<string>((resolve, context) => {
        resolve('1');
        context.final();
      }).map(value => value + '1');

      let sequence2 = Sequence.create<string>((resolve, context) => {
        resolve('2');
        context.final();
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + '2');
          context.final();
        })
      );

      let merged = ActionLib.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + 'm');
          context.final();
        })
      );

      let sequence3 = Sequence.create<string>((resolve, context) => {
        resolve('a');
        context.final();
      }).map(value => value + 's3');

      let heap: unknown[] = [];
      let combined = ActionLib.combine({
        s3: sequence3,
        m: merged
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      combined.destroy();
      await UnitTestHelper.waitForAllOperations();

      sequence1 = undefined as any;
      sequence2 = undefined as any;
      sequence3 = undefined as any;
      combined = undefined as any;
      merged = undefined as any;

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
    });
  });
});
