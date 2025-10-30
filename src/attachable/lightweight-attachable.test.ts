import { describe, expect, test, vi } from 'vitest';

import { LightweightAttachable } from './lightweight-attachable';

describe('LightweightAttachable', () => {
  test('creates instance successfully', () => {
    let instance = new LightweightAttachable().attachToRoot();
    expect(instance).toBeInstanceOf(LightweightAttachable);
  });

  test('destroyed property is false initially', () => {
    let instance = new LightweightAttachable().attachToRoot();
    expect(instance.destroyed).toBe(false);
  });

  test('not attaching to anything should throw error', () => {
    let operation = async (): Promise<void> => {
      new LightweightAttachable();
    };

    vi.useFakeTimers();
    expect(() => {
      operation();
      vi.runAllTimers();
    }).toThrow('Attachable: The object is not attached to anything!');
  });

  test('attachment is not necessary if attachable is destroyed right after creation', () => {
    let operation = async (): Promise<void> => {
      let sample = new LightweightAttachable();
      sample.destroy();
    };

    vi.useFakeTimers();
    expect(() => {
      operation();
      vi.runAllTimers();
    }).not.toThrow('Attachable: The object is not attached to anything!');
  });

  test('attach returns this for chaining', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    let result = child.attach(parent);

    expect(result).toBe(child);
  });

  test('attachToRoot returns this for chaining', () => {
    let instance = new LightweightAttachable();

    let result = instance.attachToRoot();

    expect(result).toBe(instance);
  });

  test('attach throws if already attached', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attach(parent);

    expect(() => {
      child.attach(parent);
    }).toThrow('Attachable: The object is already attached to something!');
  });

  test('attachToRoot throws if already attached', () => {
    let instance = new LightweightAttachable();

    instance.attachToRoot();

    expect(() => {
      instance.attachToRoot();
    }).toThrow('Attachable: The object is already attached to something!');
  });

  test('attach throws if attachToRoot was called first', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attachToRoot();

    expect(() => {
      child.attach(parent);
    }).toThrow('Attachable: The object is already attached to something!');
  });

  test('attachToRoot throws if attach was called first', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attach(parent);

    expect(() => {
      child.attachToRoot();
    }).toThrow('Attachable: The object is already attached to something!');
  });

  test('destroy sets destroyed to true', () => {
    let instance = new LightweightAttachable();

    instance.destroy();

    expect(instance.destroyed).toBe(true);
  });

  test('destroy can be called multiple times', () => {
    let instance = new LightweightAttachable();

    instance.destroy();
    instance.destroy();
    instance.destroy();

    expect(instance.destroyed).toBe(true);
  });

  test('destroy removes from parent', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attach(parent);
    child.destroy();

    expect(child.destroyed).toBe(true);
  });

  test('attach by parent reference', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attach(parent);

    expect(child.destroyed).toBe(false);
  });

  test('parent destroy also destroys child', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.attach(parent);
    parent.destroy();

    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
  });

  test('multiple children destroyed when parent destroys', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child1 = new LightweightAttachable().attach(parent);
    let child2 = new LightweightAttachable().attach(parent);
    let child3 = new LightweightAttachable().attach(parent);

    parent.destroy();

    expect(child1.destroyed).toBe(true);
    expect(child2.destroyed).toBe(true);
    expect(child3.destroyed).toBe(true);
  });

  test('attach when already destroyed does not throw', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable();

    child.destroy();

    expect(() => {
      child.attach(parent);
    }).not.toThrow();
  });

  test('attachToRoot when already destroyed does not throw', () => {
    let child = new LightweightAttachable();

    child.destroy();

    expect(() => {
      child.attachToRoot();
    }).not.toThrow();
  });

  test('nested attachment hierarchy', () => {
    let root = new LightweightAttachable().attachToRoot();
    let parent = new LightweightAttachable().attach(root);
    let child = new LightweightAttachable().attach(parent);

    expect(child.destroyed).toBe(false);
    expect(parent.destroyed).toBe(false);
    expect(root.destroyed).toBe(false);
  });

  test('nested destroy propagates down', () => {
    let root = new LightweightAttachable().attachToRoot();
    let parent = new LightweightAttachable().attach(root);
    let child = new LightweightAttachable().attach(parent);

    root.destroy();

    expect(root.destroyed).toBe(true);
    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
  });

  test('middle level destroy does not affect root', () => {
    let root = new LightweightAttachable().attachToRoot();
    let parent = new LightweightAttachable().attach(root);
    let child = new LightweightAttachable().attach(parent);

    parent.destroy();

    expect(root.destroyed).toBe(false);
    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
  });

  test('child destroy does not affect parent', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child = new LightweightAttachable().attach(parent);

    child.destroy();

    expect(parent.destroyed).toBe(false);
    expect(child.destroyed).toBe(true);
  });

  test('sibling attachments are independent', () => {
    let parent = new LightweightAttachable().attachToRoot();
    let child1 = new LightweightAttachable().attach(parent);
    let child2 = new LightweightAttachable().attach(parent);

    child1.destroy();

    expect(child1.destroyed).toBe(true);
    expect(child2.destroyed).toBe(false);
    expect(parent.destroyed).toBe(false);
  });

  test('complex hierarchy with multiple levels', () => {
    let root = new LightweightAttachable().attachToRoot();
    let level1a = new LightweightAttachable().attach(root);
    let level1b = new LightweightAttachable().attach(root);
    let level2a = new LightweightAttachable().attach(level1a);
    let level2b = new LightweightAttachable().attach(level1a);
    let level2c = new LightweightAttachable().attach(level1b);

    level1a.destroy();

    expect(root.destroyed).toBe(false);
    expect(level1a.destroyed).toBe(true);
    expect(level1b.destroyed).toBe(false);
    expect(level2a.destroyed).toBe(true);
    expect(level2b.destroyed).toBe(true);
    expect(level2c.destroyed).toBe(false);
  });

  test('attach to destroyed parent immediately destroys child', () => {
    let parent = new LightweightAttachable().attachToRoot();
    parent.destroy();

    let child = new LightweightAttachable().attach(parent);

    expect(child.destroyed).toBe(true);
  });
});
