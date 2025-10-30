import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ActionLibUnitTestHelper, IDAttachable } from '..';

describe('IDAttachable', () => {
  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('basic', () => {
    test('attachable should have an id', () => {
      let sample = new IDAttachable().attachToRoot();
      expect(sample.id).toBeDefined();
    });

    test('ids should be unique', () => {
      let sample1 = new IDAttachable().attachToRoot();
      let sample2 = new IDAttachable().attachToRoot();
      expect(sample1.id !== sample2.id).toBeTruthy();
    });

    test('not attaching to anything should throw error', () => {
      let operation = async (): Promise<void> => {
        new IDAttachable();
      };

      vi.useFakeTimers();
      expect(() => {
        operation();
        vi.runAllTimers();
      }).toThrow('Attachable: The object is not attached to anything!');
    });

    test('attachment is not necessary if attachable is destroyed right after creation', () => {
      let operation = async (): Promise<void> => {
        let sample = new IDAttachable();
        sample.destroy();
      };

      vi.useFakeTimers();
      expect(() => {
        operation();
        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('when attachment target is destroyed, it should destroy its attachments', () => {
      let target = new IDAttachable();
      let attachment = new IDAttachable().attach(target);
      target.destroy();

      expect(attachment.destroyed).toBeTruthy();
    });

    test('onDestroy should be triggered when destroy is called', () => {
      let destroyCalled = false;

      class Sample extends IDAttachable {
        destroy(): void {
          super.destroy();
          destroyCalled = true;
        }
      }

      let sample = new Sample().attachToRoot();
      sample.destroy();

      expect(destroyCalled).toBeTruthy();
    });

    test('attach by parent id string', () => {
      let parent = new IDAttachable().attachToRoot();
      let child = new IDAttachable();

      child.attach(parent.id);

      expect(child.destroyed).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('destroy calls should be executed attached first then parent', () => {
      class Sample extends IDAttachable {
        constructor(private destroyCallback: () => void) {
          super();
        }

        destroy(): void {
          super.destroy();
          this.destroyCallback();
        }
      }

      let heap: string[] = [];

      let sample1 = new Sample(() => heap.push('sample1')).attachToRoot();
      new Sample(() => heap.push('sample2')).attach(sample1);
      sample1.destroy();

      expect(heap).toEqual(['sample2', 'sample1']);
    });

    test('when attachment target is destroyed, it should destroy its the attachments that are attached in constructor', () => {
      let child: Attachment | undefined;

      class Target extends IDAttachable {
        constructor() {
          super();
          child = new Attachment().attach(this);
        }
      }

      class Attachment extends IDAttachable {}

      let parent = new Target().attachToRoot();
      parent.destroy();

      expect(child?.destroyed).toBeTruthy();
    });

    test('attach to self should throw error', () => {
      let sample = new IDAttachable();
      expect(() => {
        sample.attach(sample);
      }).toThrow('Circular attachment detected!');
    });

    test('circular attachment should throw error', () => {
      class Sample extends IDAttachable {}

      let sample1 = new Sample();
      let sample2 = new Sample();

      expect(() => {
        sample2.attach(sample1);
        sample1.attach(sample2);
      }).toThrow('Circular attachment detected!');
    });
  });

  describe('onDestroy', () => {
    test('callback is invoked when attachable is destroyed', () => {
      let callbackInvoked = false;
      let sample = new IDAttachable().attachToRoot();

      sample
        .onDestroy(() => {
          callbackInvoked = true;
        })
        .attachToRoot();

      sample.destroy();
      expect(callbackInvoked).toBeTruthy();
    });

    test('callback is invoked immediately if attachable is already destroyed', () => {
      let callbackInvoked = false;
      let sample = new IDAttachable().attachToRoot();

      sample.destroy();

      sample
        .onDestroy(() => {
          callbackInvoked = true;
        })
        .attachToRoot();

      expect(callbackInvoked).toBeTruthy();
    });

    test('multiple callbacks can be subscribed and all are invoked', () => {
      let callback1Invoked = false;
      let callback2Invoked = false;
      let callback3Invoked = false;
      let sample = new IDAttachable().attachToRoot();

      sample
        .onDestroy(() => {
          callback1Invoked = true;
        })
        .attachToRoot();
      sample
        .onDestroy(() => {
          callback2Invoked = true;
        })
        .attachToRoot();
      sample
        .onDestroy(() => {
          callback3Invoked = true;
        })
        .attachToRoot();

      sample.destroy();

      expect([callback1Invoked, callback2Invoked, callback3Invoked]).toEqual([true, true, true]);
    });

    test('subscription can be unsubscribed', () => {
      let callbackInvoked = false;
      let sample = new IDAttachable().attachToRoot();

      let subscription = sample
        .onDestroy(() => {
          callbackInvoked = true;
        })
        .attachToRoot();

      subscription.destroy();
      sample.destroy();

      expect(callbackInvoked).toBeFalsy();
    });

    test('error in callback is caught and logged when attachable is already destroyed', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let sample = new IDAttachable().attachToRoot();

      sample.destroy();

      let error = new Error('Test error');
      sample
        .onDestroy(() => {
          throw error;
        })
        .attachToRoot();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', error);
      consoleErrorSpy.mockRestore();
    });

    test('callback is not invoked after unsubscribe even if other callbacks exist', () => {
      let callback1Invoked = false;
      let callback2Invoked = false;
      let sample = new IDAttachable().attachToRoot();

      let subscription1 = sample
        .onDestroy(() => {
          callback1Invoked = true;
        })
        .attachToRoot();
      sample
        .onDestroy(() => {
          callback2Invoked = true;
        })
        .attachToRoot();

      subscription1.destroy();
      sample.destroy();

      expect([callback1Invoked, callback2Invoked]).toEqual([false, true]);
    });

    test('triggereding destroy multiple times should not take effect multiply', () => {
      let triggerCount = 0;
      let sample = new IDAttachable().attachToRoot();

      sample
        .onDestroy(() => {
          triggerCount++;
        })
        .attachToRoot();

      sample.destroy();
      sample.destroy();

      expect(triggerCount).toBe(1);
    });

    test('onDestroy should be triggered when destroy listener is attached to the attachable that owns the onDestroy', () => {
      let callbackInvoked = false;
      let sample = new IDAttachable().attachToRoot();

      sample
        .onDestroy(() => {
          callbackInvoked = true;
        })
        .attach(sample);

      sample.destroy();
      expect(callbackInvoked).toBeTruthy();
    });

    test('onDestroy should be triggered if it is listened by take(1)', () => {
      let callbackInvoked = false;
      let sample = new IDAttachable().attachToRoot();

      sample
        .onDestroy()
        .take(1)
        .read(() => {
          callbackInvoked = true;
        })
        .attachToRoot();

      sample.destroy();
      expect(callbackInvoked).toBeTruthy();
    });
  });

  describe('validateId', () => {
    test('valid target valid id', () => {
      class Child extends IDAttachable {}
      let child = new Child().attachToRoot();
      expect(Child.validateId(child.id)).toBe(true);
    });

    test('invalid target valid id', () => {
      class Child1 extends IDAttachable {}
      class Child2 extends IDAttachable {}

      let child1 = new Child1().attachToRoot();

      expect(Child2.validateId(child1.id)).toBe(false);
    });

    test('invalid id', () => {
      class Child extends IDAttachable {}
      expect(Child.validateId('invalidId')).toBe(false);
    });
  });
});
