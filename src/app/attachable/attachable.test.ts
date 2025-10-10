import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from './attachable';
import { AttachableStore } from './attachable.store';

describe('Attachable', () => {
  beforeEach(() => {
    AttachableStore.hardReset();
  });

  describe('basic', () => {
    test('attachable should have an id', () => {
      class Sample extends Attachable {}
      let sample = new Sample().attachToRoot();
      expect(sample.id).toBeDefined();
    });

    test('ids should be unique', () => {
      class Sample extends Attachable {}
      let sample1 = new Sample().attachToRoot();
      let sample2 = new Sample().attachToRoot();
      expect(sample1.id !== sample2.id).toBeTruthy();
    });

    test('when attachment target is destroyed, it should destroy its attachments', () => {
      class Target extends Attachable {}
      class Attachment extends Attachable {}

      let target = new Target();
      let attachment = new Attachment().attach(target);

      target.destroy();

      expect(attachment.destroyed).toBeTruthy();
    });

    test('onDestroy should be triggered when destroy is called', () => {
      let destroyCalled = false;

      class Sample extends Attachable {
        destroy(): void {
          super.destroy();
          destroyCalled = true;
        }
      }

      let sample = new Sample().attachToRoot();
      sample.destroy();

      expect(destroyCalled).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    test('destroy calls should be executed attached first then parent', () => {
      class Sample extends Attachable {
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

      class Target extends Attachable {
        constructor() {
          super();
          child = new Attachment().attach(this);
        }
      }

      class Attachment extends Attachable {}

      let parent = new Target().attachToRoot();
      parent.destroy();

      expect(child?.destroyed).toBeTruthy();
    });

    test('onDestroy should be triggered when destroy listener is attached to itself', () => {
      // TODO
    });

    test('attach to self should throw error', () => {
      class Sample extends Attachable {}

      let sample = new Sample();
      expect(() => {
        sample.attach(sample);
      }).toThrow('Circular attachment detected!');
    });

    test('circular attachment should throw error', () => {
      class Sample extends Attachable {}

      let sample1 = new Sample();
      let sample2 = new Sample();

      expect(() => {
        sample2.attach(sample1);
        sample1.attach(sample2);
      }).toThrow('Circular attachment detected!');
    });

    test('triggereding destroy multiple times should not take effect multiply', () => {
      // TODO
    });

    test('attachment is not necessary if attachable is destroyed right after creation', () => {
      class Sample extends Attachable {}

      let operation = async (): Promise<void> => {
        let sample = new Sample();
        sample.destroy();
      };

      vi.useFakeTimers();
      expect(() => {
        operation();
        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
      vi.useRealTimers();
    });
  });
});
