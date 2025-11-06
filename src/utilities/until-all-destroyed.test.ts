import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { IDAttachable } from '../attachable/id-attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { PerformanceUnitTestHelper } from '../sequence/performance-unit-test.helper';
import { CallbackUtilities } from './callback-utilities';

describe('UntilAllDestroyed', () => {
  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('untilAllDestroyed', () => {
    test('sample', () => {
      let obj1 = new Attachable().attachToRoot();
      let obj2 = new Attachable().attachToRoot();
      let obj3 = new Attachable().attachToRoot();

      let triggered = false;
      CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3])
        .read(() => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(false);
      obj1.destroy();
      expect(triggered).toBe(false);
      obj2.destroy();
      expect(triggered).toBe(false);
      obj3.destroy();
      expect(triggered).toBe(true);
    });

    test('irregular', () => {
      let triggered = false;

      let obj1 = new Attachable().attachToRoot();
      obj1.destroy();
      let obj2 = new Attachable().attachToRoot();
      let obj3 = new Attachable().attachToRoot();

      CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3])
        .read(() => {
          triggered = true;
        })
        .attachToRoot();

      obj2.destroy();
      expect(triggered).toBe(false);
      obj3.destroy();
      expect(triggered).toBe(true);
    });

    test('all destroy subscriptions should be destroyed when sequence is destroyed', () => {
      let obj = new Attachable().attachToRoot();

      let sequence = CallbackUtilities.untilAllDestroyed([obj]).attachToRoot();
      expect(obj['_attachments']?.size).toEqual(1);
      expect(sequence['executor']['_attachments']?.size).toEqual(1);
      sequence.destroy();
      expect(obj['_attachments']?.size).toEqual(0);
      expect(sequence['executor']['_attachments']).toEqual(undefined);
    });
  });

  describe.skipIf(!process.env.MANUAL)('performance', () => {
    test('performance', async () => {
      await PerformanceUnitTestHelper.testPerformance(() => {
        let obj1 = new IDAttachable().attachToRoot();
        let obj2 = new IDAttachable().attachToRoot();
        let obj3 = new IDAttachable().attachToRoot();

        CallbackUtilities.untilAllDestroyed([obj1, obj2, obj3])
          .read(() => {})
          .attachToRoot();
      });
      // 3.5130999088287354 -> 4.707000017166138
    }, 60000);
  });
});
