import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { SingleEvent } from '../../../single-event/single-event';
import { Sequence } from '../../sequence';

describe('Sequence Async Tap', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple sequence sync triggers with sync callback', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
      })
        .asyncTap(data => heap.push(data))
        .attachToRoot();

      resolve('b');
      expect(heap).toEqual(['a', 'b']);
    });

    test('multiple instant resolution with sync callback', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .asyncTap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('simple sequence mixed triggers with sync callback', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .asyncTap(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
    });
  });

  describe('Behavior', () => {
    test('sync callback chain', () => {
      let heap: string[] = [];

      Sequence.create(resolve => resolve())
        .asyncTap(() => {
          heap.push('a');
        })
        .asyncTap(() => {
          heap.push('b');
        })
        .asyncTap(() => {
          heap.push('c');
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('async callback chain', async () => {
      let heap: string[] = [];
      let resolve1!: () => void;
      let resolve2!: () => void;

      Sequence.create<string>(resolve => resolve('value'))
        .asyncTap(value => {
          heap.push(value + '1');
          return SingleEvent.create<void>(r => {
            resolve1 = r;
          });
        })
        .asyncTap(value => {
          heap.push(value + '2');
          return SingleEvent.create<void>(r => {
            resolve2 = r;
          });
        })
        .tap(value => heap.push(value + 'f'))
        .attachToRoot();

      expect(heap).toEqual(['value1']);

      resolve1();
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['value1', 'value2']);

      resolve2();
      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['value1', 'value2', 'valuef']);
    });
  });

  describe('Error Handling', () => {
    test('error in callback logs to console and stops execution', () => {
      let heap: string[] = [];
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      Sequence.create<string>(resolve => resolve('test'))
        .asyncTap(() => {
          heap.push('before-error');
          throw new Error('Test error');
        })
        .tap(() => {
          heap.push('after-error');
        })
        .attachToRoot();

      expect(heap).toEqual(['before-error']);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Sequence callback function error: ', expect.any(Error));
      expect(heap).not.toContain('after-error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(resolve => {
        resolve();
        return () => {
          triggered = true;
        };
      })
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .asyncTap(() => SingleEvent.instant())
        .attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });

    test('async operation attached to context is destroyed when sequence is destroyed', async () => {
      let asyncOpDestroyed = false;

      let sequence = Sequence.create<string>(resolve => resolve('test'))
        .asyncTap(() => {
          return SingleEvent.create<void>(() => {
            return () => {
              asyncOpDestroyed = true;
            };
          });
        })
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(asyncOpDestroyed).toBeFalsy();

      sequence.destroy();
      expect(asyncOpDestroyed).toBeTruthy();
    });
  });
});
