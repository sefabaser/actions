import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Action } from '../../observables/action/action';
import { Sequence } from '../../stream/sequence/sequence';
import { SingleEvent } from '../../stream/single-event/single-event';
import { ActionLib } from '../action-lib';

describe('Any', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('single event merge', async () => {
      let heap: string[] = [];

      ActionLib.any(
        SingleEvent.create<string>(resolve => resolve('a')),
        SingleEvent.create<string>(resolve => resolve('b')),
        SingleEvent.create<string>(resolve => resolve('c'))
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('empty merge', () => {
      let heap: unknown[] = [];
      ActionLib.any()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
    });

    test('action merge', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      ActionLib.any(action1, action2)
        .tap(value => heap.push(value))
        .attachToRoot();

      action1.trigger('a');
      action2.trigger('b');
      expect(heap).toEqual(['a']);
    });

    test('merging instantly resolved singleEvents', async () => {
      let heap: string[] = [];

      let s1 = SingleEvent.instant('a');
      let s2 = SingleEvent.instant('b');

      let merged = ActionLib.any(s1, s2);
      let read = merged.tap(data => heap.push(data)).attachToRoot();

      expect(heap).toEqual(['a']);
      expect(s1.destroyed).toBeTruthy();
      expect(s2.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(read.destroyed).toBeTruthy();
    });

    test('merge with delayed singleEvents', async () => {
      let heap: string[] = [];
      ActionLib.any(
        SingleEvent.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve)),
        SingleEvent.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
        SingleEvent.create<string>(resolve => UnitTestHelper.callEachDelayed(['x', 'y'], resolve))
      )
        .tap(data => heap.push(data))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1']);
    });

    test('merging mixed async operations', async () => {
      let heap: unknown[] = [];

      let sequence = Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve));
      let singleEvent = SingleEvent.instant('single');
      let action = new Action<string>();

      ActionLib.any(sequence, singleEvent, action)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['single']);

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['single']);

      action.trigger('action');
      expect(heap).toEqual(['single']);
    });
  });

  describe('Desctruction', () => {
    test('merge destroy -> children destroy', async () => {
      let singleEvent1 = SingleEvent.create(() => {});
      let singleEvent2 = SingleEvent.create(() => {});
      let merged = ActionLib.any(singleEvent1, singleEvent2).attachToRoot();

      expect(singleEvent1.destroyed).toBeFalsy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(singleEvent1['_executor']['_onDestroyListeners'].size).toEqual(1);
      expect(singleEvent2['_executor']['_onDestroyListeners'].size).toEqual(1);
      merged.destroy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(singleEvent1['_executor']['_onDestroyListeners'].size).toEqual(0);
      expect(singleEvent2['_executor']['_onDestroyListeners'].size).toEqual(0);
    });

    test('children destroy -> merge destroy', async () => {
      let singleEvent1 = SingleEvent.create(() => {});
      let singleEvent2 = SingleEvent.create(() => {});
      let merged = ActionLib.any(singleEvent1, singleEvent2).attachToRoot();

      expect(merged.destroyed).toBeFalsy();
      singleEvent1.destroy();
      expect(merged.destroyed).toBeFalsy();
      singleEvent2.destroy();
      expect(merged.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('merged singleEvents should not need to be attached manually', () => {
      vi.useFakeTimers();
      expect(() => {
        let singleEvent1 = SingleEvent.create(() => {});
        let singleEvent = SingleEvent.create(() => {});
        ActionLib.any(singleEvent1, singleEvent).attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('merging same singleEvent should throw error', () => {
      let singleEvent = SingleEvent.create(() => {}).attachToRoot();
      expect(() => ActionLib.any(singleEvent, singleEvent).attachToRoot()).toThrow(
        'Each given async operation to merge or combine has to be diferent.'
      );
    });

    test('merging same notifier should throw error', () => {
      let action = new Action<string>();
      expect(() => ActionLib.any(action, action).attachToRoot()).toThrow(
        'Each given async operation to merge or combine has to be diferent.'
      );
    });

    test('merging a finalized singleEvent which had a delayed map link was throwing error', async () => {
      let singleEvent = SingleEvent.instant()
        .asyncMap(() =>
          SingleEvent.create(resolve => {
            UnitTestHelper.callEachDelayed([1], () => resolve());
          })
        )
        .tap(() => {});

      let heap: unknown[] = [];
      ActionLib.any(singleEvent)
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
    });
  });
});
