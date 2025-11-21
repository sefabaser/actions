import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Action } from '../../observables/action/action';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { ActionLib } from '../action-lib';

describe('Merge', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('sequence merge', async () => {
      let heap: string[] = [];

      ActionLib.merge(
        Sequence.create<string>(resolve => resolve('a')),
        Sequence.create<string>(resolve => resolve('b')),
        Sequence.create<string>(resolve => resolve('c'))
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('single event merge', async () => {
      let heap: string[] = [];

      ActionLib.merge(
        SingleEvent.create<string>(resolve => resolve('a')),
        SingleEvent.create<string>(resolve => resolve('b')),
        SingleEvent.create<string>(resolve => resolve('c'))
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('action merge', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      ActionLib.merge(action1, action2)
        .tap(value => heap.push(value))
        .attachToRoot();

      action1.trigger('a');
      action2.trigger('b');
      expect(heap).toEqual(['a', 'b']);
    });

    test('merging instantly resolved sequences', async () => {
      let heap: string[] = [];

      let s1 = Sequence.instant('a').take(1);
      let s2 = Sequence.instant('b').take(1);

      let merged = ActionLib.merge(s1, s2);
      let read = merged.tap(data => heap.push(data)).attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b']);
      expect(s1.destroyed).toBeTruthy();
      expect(s2.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(read.destroyed).toBeTruthy();
    });

    test('instantly resolved and finalized sequences', async () => {
      let heap: string[] = [];

      ActionLib.merge(
        Sequence.create<string>((resolve, context) => {
          resolve('a');
          context.final();
        }),
        Sequence.create<string>((resolve, context) => {
          resolve('b');
          context.final();
        }),
        Sequence.create<string>((resolve, context) => {
          resolve('c');
          context.final();
        })
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('merge with delayed sequences', async () => {
      let heap: string[] = [];
      ActionLib.merge(
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve)),
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['x', 'y'], resolve))
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1', 'a', 'x', '2', 'b', 'y']);
    });

    test('merging mixed async operations', async () => {
      let heap: unknown[] = [];

      let sequence = Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve));
      let singleEvent = SingleEvent.instant('single');
      let action = new Action<string>();

      ActionLib.merge(sequence, singleEvent, action)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['single']);

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['single', '1', '2']);

      action.trigger('action');
      expect(heap).toEqual(['single', '1', '2', 'action']);
    });
  });

  describe('Desctruction', () => {
    test('merge destroy -> children destroy', async () => {
      let sequence1 = Sequence.create(() => {});
      let sequence2 = Sequence.create(() => {});
      let merged = ActionLib.merge(sequence1, sequence2).attachToRoot();

      expect(sequence1.destroyed).toBeFalsy();
      expect(sequence2.destroyed).toBeFalsy();
      expect(sequence1['_executor']['_onDestroyListeners'].size).toEqual(1);
      expect(sequence2['_executor']['_onDestroyListeners'].size).toEqual(1);
      merged.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
      expect(sequence1['_executor']['_onDestroyListeners'].size).toEqual(0);
      expect(sequence2['_executor']['_onDestroyListeners'].size).toEqual(0);
    });

    test('children destroy -> merge destroy', async () => {
      let sequence1 = Sequence.create(() => {});
      let sequence2 = Sequence.create(() => {});
      let merged = ActionLib.merge(sequence1, sequence2).attachToRoot();

      expect(merged.destroyed).toBeFalsy();
      sequence1.destroy();
      expect(merged.destroyed).toBeFalsy();
      sequence2.destroy();
      expect(merged.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('merged sequences should not need to be attached manually', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence1 = Sequence.create(() => {});
        let sequence = Sequence.create(() => {});
        ActionLib.merge(sequence1, sequence).attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('merging same sequence should throw error', () => {
      let sequence = Sequence.create(() => {});
      expect(() => ActionLib.merge(sequence, sequence).attachToRoot()).toThrow(
        'Each given sequence to merge or combine has to be diferent.'
      );
    });

    test('merging same notifier should throw error', () => {
      let action = new Action<string>();
      expect(() => ActionLib.merge(action, action).attachToRoot()).toThrow(
        'Each given sequence to merge or combine has to be diferent.'
      );
    });

    test('merging a finalized sequence which had a delayed map link was throwing error', async () => {
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
      ActionLib.merge(sequence)
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
    });
  });
});
