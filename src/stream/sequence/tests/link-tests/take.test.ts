import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { Action } from '../../../../observables/action/action';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Take', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .take(3)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual(['a', 'b', 'x']);
    });

    test('mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .take(5)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'x', 'y', 'k']);
    });

    test('taking more than triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      let sequence = Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .take(5)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual(['a', 'b', 'x', 'y']);
      expect(sequence.destroyed).toBeFalsy();
    });

    test('instantly resolving the sequence should not block the chain', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => resolve('a'))
        .take(1)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('taking less then instant triggers', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .take(2)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b']);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .take(2)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(resolve => {
        resolve();
        return () => {
          triggered = true;
        };
      });

      expect(triggered).toBeFalsy();
      sequence.take(1).attachToRoot();
      expect(triggered).toBeTruthy();
    });

    test('directly resolved sequence callback', () => {
      let heap: string[] = [];
      Sequence.create(resolve => {
        resolve();
        return () => heap.push('destroyed');
      })
        .read(() => heap.push('read1'))
        .take(1)
        .read(() => heap.push('read2'))
        .attachToRoot();

      expect(heap).toEqual(['read1', 'read2', 'destroyed']);
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .take(2)
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('completing takes should destroy the sequence', () => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r;
      })
        .take(1)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      resolve();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('take should destroy the sequence after all ongoing operations completed and cancel all packages coming behind', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();
      let actionlast = new Action<string>();

      let heap: string[] = [];
      let sequence = Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
        resolve(3);
      })
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            if (data === 1) {
              action1.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            } else if (data === 2) {
              action1.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            } else {
              action2.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            }
          })
        )
        .take(1)
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            actionlast.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
          })
        )
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(2);
      expect(action2.listenerCount).toEqual(1);
      expect(actionlast.listenerCount).toEqual(0);

      action1.trigger('-a1');
      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(1);

      actionlast.trigger('-al');
      expect(heap).toEqual(['1-a1-al']);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(0);
    });
  });
});
