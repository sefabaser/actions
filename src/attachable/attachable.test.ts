import { describe, expect, test, vi } from 'vitest';

import { Attachable } from './attachable';

describe('Attachable', () => {
  describe('Setup', () => {
    test('creates instance successfully', () => {
      let instance = new Attachable().attachToRoot();
      expect(instance).toBeInstanceOf(Attachable);
    });

    test('destroyed property is false initially', () => {
      let instance = new Attachable().attachToRoot();
      expect(instance.destroyed).toBe(false);
    });

    test('attachment is not necessary if attachable is destroyed right after creation', () => {
      let operation = async (): Promise<void> => {
        let sample = new Attachable();
        sample.destroy();
      };

      vi.useFakeTimers();
      expect(() => {
        operation();
        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attach returns this for chaining', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      let result = child.attach(parent);

      expect(result).toBe(child);
    });

    test('attachToRoot returns this for chaining', () => {
      let instance = new Attachable();

      let result = instance.attachToRoot();

      expect(result).toBe(instance);
    });
  });

  describe('Behaviour', () => {
    test('not attaching to anything should throw error', () => {
      let operation = async (): Promise<void> => {
        new Attachable();
      };

      vi.useFakeTimers();
      expect(() => {
        operation();
        vi.runAllTimers();
      }).toThrow('Attachable: The object is not attached to anything!');
    });

    test('attach throws if already attached', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attach(parent);

      expect(() => {
        child.attach(parent);
      }).toThrow('Attachable: The object is already attached to something!');
    });

    test('attachToRoot throws if already attached', () => {
      let instance = new Attachable();

      instance.attachToRoot();

      expect(() => {
        instance.attachToRoot();
      }).toThrow('Attachable: The object is already attached to something!');
    });

    test('attach throws if attachToRoot was called first', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attachToRoot();

      expect(() => {
        child.attach(parent);
      }).toThrow('Attachable: The object is already attached to something!');
    });

    test('attachToRoot throws if attach was called first', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attach(parent);

      expect(() => {
        child.attachToRoot();
      }).toThrow('Attachable: The object is already attached to something!');
    });

    test('destroy sets destroyed to true', () => {
      let instance = new Attachable();

      instance.destroy();

      expect(instance.destroyed).toBe(true);
    });

    test('destroy can be called multiple times', () => {
      let instance = new Attachable();

      instance.destroy();
      instance.destroy();
      instance.destroy();

      expect(instance.destroyed).toBe(true);
    });

    test('destroy removes from parent', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attach(parent);
      child.destroy();

      expect(child.destroyed).toBe(true);
    });

    test('attach by parent reference', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attach(parent);

      expect(child.destroyed).toBe(false);
    });

    test('attach when already destroyed does not throw', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.destroy();

      expect(() => {
        child.attach(parent);
      }).not.toThrow();
    });

    test('attachToRoot when already destroyed does not throw', () => {
      let child = new Attachable();

      child.destroy();

      expect(() => {
        child.attachToRoot();
      }).not.toThrow();
    });

    test('nested attachment hierarchy', () => {
      let root = new Attachable().attachToRoot();
      let parent = new Attachable().attach(root);
      let child = new Attachable().attach(parent);

      expect(child.destroyed).toBe(false);
      expect(parent.destroyed).toBe(false);
      expect(root.destroyed).toBe(false);
    });
  });

  describe('Desctruction', () => {
    test('parent destroy also destroys child', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable();

      child.attach(parent);
      parent.destroy();

      expect(parent.destroyed).toBe(true);
      expect(child.destroyed).toBe(true);
    });

    test('multiple children destroyed when parent destroys', () => {
      let parent = new Attachable().attachToRoot();
      let child1 = new Attachable().attach(parent);
      let child2 = new Attachable().attach(parent);
      let child3 = new Attachable().attach(parent);

      parent.destroy();

      expect(child1.destroyed).toBe(true);
      expect(child2.destroyed).toBe(true);
      expect(child3.destroyed).toBe(true);
    });

    test('nested destroy propagates down', () => {
      let root = new Attachable().attachToRoot();
      let parent = new Attachable().attach(root);
      let child = new Attachable().attach(parent);

      root.destroy();

      expect(root.destroyed).toBe(true);
      expect(parent.destroyed).toBe(true);
      expect(child.destroyed).toBe(true);
    });

    test('middle level destroy does not affect root', () => {
      let root = new Attachable().attachToRoot();
      let parent = new Attachable().attach(root);
      let child = new Attachable().attach(parent);

      parent.destroy();

      expect(root.destroyed).toBe(false);
      expect(parent.destroyed).toBe(true);
      expect(child.destroyed).toBe(true);
    });

    test('child destroy does not affect parent', () => {
      let parent = new Attachable().attachToRoot();
      let child = new Attachable().attach(parent);

      child.destroy();

      expect(parent.destroyed).toBe(false);
      expect(child.destroyed).toBe(true);
    });

    test('sibling attachments are independent', () => {
      let parent = new Attachable().attachToRoot();
      let child1 = new Attachable().attach(parent);
      let child2 = new Attachable().attach(parent);

      child1.destroy();

      expect(child1.destroyed).toBe(true);
      expect(child2.destroyed).toBe(false);
      expect(parent.destroyed).toBe(false);
    });

    test('complex hierarchy with multiple levels', () => {
      let root = new Attachable().attachToRoot();
      let level1a = new Attachable().attach(root);
      let level1b = new Attachable().attach(root);
      let level2a = new Attachable().attach(level1a);
      let level2b = new Attachable().attach(level1a);
      let level2c = new Attachable().attach(level1b);

      level1a.destroy();

      expect(root.destroyed).toBe(false);
      expect(level1a.destroyed).toBe(true);
      expect(level1b.destroyed).toBe(false);
      expect(level2a.destroyed).toBe(true);
      expect(level2b.destroyed).toBe(true);
      expect(level2c.destroyed).toBe(false);
    });

    test('attach to destroyed parent immediately destroys child', () => {
      let parent = new Attachable().attachToRoot();
      parent.destroy();

      let child = new Attachable().attach(parent);

      expect(child.destroyed).toBe(true);
    });
  });

  describe('Circular attachment detection', () => {
    test('circular attachment detection - direct self-reference', () => {
      vi.useFakeTimers();

      expect(() => {
        let attachable = new Attachable().attachToRoot();
        // Manually create a circular reference by setting the parent to itself
        attachable['_attachedParentVar'] = attachable;
        vi.runAllTimers();
      }).toThrow('Circular attachment detected!');
    });

    test('circular attachment detection - two-level cycle', () => {
      vi.useFakeTimers();

      expect(() => {
        let parent = new Attachable().attachToRoot();
        let child = new Attachable().attach(parent);
        // Create circular reference: parent -> child -> parent
        parent['_attachedParentVar'] = child;
        vi.runAllTimers();
      }).toThrow('Circular attachment detected!');
    });

    test('circular attachment detection - three-level cycle', () => {
      vi.useFakeTimers();

      expect(() => {
        let root = new Attachable().attachToRoot();
        let middle = new Attachable().attach(root);
        let leaf = new Attachable().attach(middle);
        // Create circular reference: root -> middle -> leaf -> root
        root['_attachedParentVar'] = leaf;
        vi.runAllTimers();
      }).toThrow('Circular attachment detected!');
    });

    test('normal hierarchy does not trigger circular detection', () => {
      vi.useFakeTimers();

      expect(() => {
        let root = new Attachable().attachToRoot();
        let level1 = new Attachable().attach(root);
        let level2 = new Attachable().attach(level1);
        new Attachable().attach(level2);
        vi.runAllTimers();
      }).not.toThrow('Circular attachment detected!');
    });
  });
});
