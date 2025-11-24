import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Action } from '../../observables/action/action';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { ActionLib } from '../action-lib';

describe('All', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    describe('Object Input', () => {
      test('simple combine', () => {
        let sequence1 = Sequence.create<string>(resolve => resolve('a'));
        let sequence2 = Sequence.create<number>(resolve => resolve(1));

        let heap: { a: string; b: number }[] = [];
        ActionLib.all({ a: sequence1, b: sequence2 })
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([{ a: 'a', b: 1 }]);
      });

      test('instantly finalizing sequences', () => {
        let sequence1 = Sequence.create<string>((resolve, context) => {
          resolve('a');
          context.final();
        });
        let sequence2 = Sequence.create<number>((resolve, context) => {
          resolve(1);
          context.final();
        });

        let heap: { a: string; b: number }[] = [];
        ActionLib.all({ a: sequence1, b: sequence2 })
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([{ a: 'a', b: 1 }]);
      });

      test('using action directly', () => {
        let action1 = new Action<string>();
        let action2 = new Action<number>();

        let heap: { a: string; b: number }[] = [];
        ActionLib.all({ a: action1, b: action2 })
          .tap(value => heap.push(value))
          .attachToRoot();

        action1.trigger('a');
        action2.trigger(1);
        expect(heap).toEqual([{ a: 'a', b: 1 }]);
      });

      test('combine instantly getting resolved sequences', async () => {
        let heap: { a: string; b: number }[] = [];

        let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
        let s2 = Sequence.create<number>(resolve => resolve(1)).take(1);

        let combined = ActionLib.all({ a: s1, b: s2 })
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([{ a: 'a', b: 1 }]);
        expect(s1.destroyed).toBeTruthy();
        expect(s2.destroyed).toBeTruthy();
        expect(combined.destroyed).toBeTruthy();
      });

      test('combine with delayed sequences', async () => {
        let heap: { a: string; b: number }[] = [];
        ActionLib.all({
          a: Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
          b: Sequence.create<number>(resolve => UnitTestHelper.callEachDelayed([1, 2], resolve))
        })
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual([{ a: 'a', b: 1 }]);
      });

      test('combining mixed async operations', async () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve));
        let singleEvent = SingleEvent.instant('single');
        let action = new Action<string>();

        ActionLib.all({
          sequence,
          singleEvent,
          action
        })
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual([]);

        action.trigger('action');
        expect(heap).toEqual([
          {
            action: 'action',
            sequence: '2',
            singleEvent: 'single'
          }
        ]);
      });
    });

    describe('Array Input', () => {
      test('simple combine', () => {
        let sequence1 = Sequence.create<string>(resolve => resolve('a'));
        let sequence2 = Sequence.create<number>(resolve => resolve(1));

        let heap: unknown[] = [];
        ActionLib.all([sequence1, sequence2])
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([['a', 1]]);
      });

      test('instantly finalizing sequences', () => {
        let sequence1 = Sequence.create<string>((resolve, context) => {
          resolve('a');
          context.final();
        });
        let sequence2 = Sequence.create<number>((resolve, context) => {
          resolve(1);
          context.final();
        });

        let heap: unknown[] = [];
        ActionLib.all([sequence1, sequence2])
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([['a', 1]]);
      });

      test('using action directly', () => {
        let action1 = new Action<string>();
        let action2 = new Action<number>();

        let heap: unknown[] = [];
        ActionLib.all([action1, action2])
          .tap(value => heap.push(value))
          .attachToRoot();

        action1.trigger('a');
        action2.trigger(1);
        expect(heap).toEqual([['a', 1]]);
      });

      test('combine instantly getting destroyed sequences', async () => {
        let heap: unknown[] = [];

        let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
        let s2 = Sequence.create<number>(resolve => resolve(1)).take(1);

        let combined = ActionLib.all([s1, s2])
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([['a', 1]]);
        expect(s1.destroyed).toBeTruthy();
        expect(s2.destroyed).toBeTruthy();
        expect(combined.destroyed).toBeTruthy();
      });

      test('combine with delayed sequences', async () => {
        let heap: unknown[] = [];
        ActionLib.all([
          Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
          Sequence.create<number>(resolve => UnitTestHelper.callEachDelayed([1, 2], resolve))
        ])
          .tap(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual([['a', 1]]);
      });

      test('combining mixed async operations', async () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve));
        let singleEvent = SingleEvent.instant('single');
        let action = new Action<string>();

        ActionLib.all([sequence, singleEvent, action])
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual([]);

        action.trigger('action');
        expect(heap).toEqual([['2', 'single', 'action']]);
      });
    });
  });

  describe('Desctruction', () => {
    test('merge destroy -> children destroy', async () => {
      let sequence1 = Sequence.create<string>(() => {});
      let sequence = Sequence.create<string>(() => {});
      let combined = ActionLib.all({ a: sequence1, b: sequence }).attachToRoot();

      expect(sequence1.destroyed).toBeFalsy();
      expect(sequence.destroyed).toBeFalsy();
      combined.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('children destroy -> merge destroy', async () => {
      let sequence1 = Sequence.create<string>(() => {});
      let sequence = Sequence.create<string>(() => {});
      let combined = ActionLib.all({ a: sequence1, b: sequence }).attachToRoot();

      expect(combined.destroyed).toBeFalsy();
      sequence1.destroy();
      expect(combined.destroyed).toBeFalsy();
      sequence.destroy();
      expect(combined.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('combined sequences should not need to be attached manually', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence1 = Sequence.create<string>(() => {});
        let sequence = Sequence.create<string>(() => {});
        ActionLib.all({ a: sequence1, b: sequence }).attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('combining same sequence should throw error', () => {
      let sequence = Sequence.create(() => {});
      expect(() => ActionLib.all({ a: sequence, b: sequence }).attachToRoot()).toThrow(
        'Each given async operation to merge or combine has to be diferent.'
      );
    });

    test('combining same notifier should throw error', () => {
      let action = new Action<string>();
      expect(() => ActionLib.all({ a: action, b: action }).attachToRoot()).toThrow(
        'Each given async operation to merge or combine has to be diferent.'
      );
    });

    test('combining a finalized sequence which had a delayed map link was throwing error', async () => {
      let sequence = Sequence.create((resolve, context) => {
        resolve();
        context.final();
      })
        .asyncMapOrdered(() =>
          Sequence.create(resolve => {
            UnitTestHelper.callEachDelayed([1], () => resolve());
          })
        )
        .tap(() => {});

      let heap: unknown[] = [];
      ActionLib.all({
        s: sequence
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
    });

    test('combination should not be resolve more than once', async () => {
      vi.useFakeTimers();

      let heap: unknown[] = [];

      let singleEvent1 = SingleEvent.instant('a');
      let singleEvent2 = SingleEvent.instant('b');

      let resolve!: (value: string) => void;
      let sequence = Sequence.create<string>(r => {
        resolve = r;
      });

      ActionLib.all([singleEvent1, singleEvent2, sequence])
        .wait()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(sequence.destroyed).toBeFalsy();

      resolve('c');
      expect(heap).toEqual([]);
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(sequence.destroyed).toBeTruthy();

      vi.runAllTimers();
      expect(heap).toEqual([['a', 'b', 'c']]);
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(sequence.destroyed).toBeTruthy();

      resolve('d');
      vi.runAllTimers();
      expect(heap).toEqual([['a', 'b', 'c']]);
    });
  });
});
