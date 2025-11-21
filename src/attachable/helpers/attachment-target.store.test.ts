import { beforeEach, describe, expect, test } from 'vitest';

import { ActionLib } from '../../utilities/action-lib';
import { IDAttachable } from '../id-attachable';
import { AttachmentTargetStore } from './attachment-target.store';

describe('AttachmentTargetStore', () => {
  beforeEach(() => {
    ActionLib.hardReset();
  });

  describe('registerAttachmentTarget', () => {
    test('generates unique id for single instance', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      expect(id).toBe(1);
    });

    test('generates sequential ids for multiple instances of same class', () => {
      class TestClass extends IDAttachable {}

      let instance1 = new TestClass().attachToRoot();
      let instance2 = new TestClass().attachToRoot();
      let instance3 = new TestClass().attachToRoot();

      expect([instance1.id, instance2.id, instance3.id]).toEqual([1, 2, 3]);
    });

    test('generates different class ids for different classes', () => {
      class TestClass1 extends IDAttachable {}
      class TestClass2 extends IDAttachable {}

      let instance1 = new TestClass1().attachToRoot();
      let instance2 = new TestClass2().attachToRoot();

      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
    });

    test('maintains separate numbering for different classes', () => {
      class TestClass1 extends IDAttachable {}
      class TestClass2 extends IDAttachable {}

      let instance1a = new TestClass1().attachToRoot();
      let instance2a = new TestClass2().attachToRoot();
      let instance1b = new TestClass1().attachToRoot();
      let instance2b = new TestClass2().attachToRoot();

      expect([instance1a.id, instance2a.id, instance1b.id, instance2b.id]).toEqual([1, 2, 3, 4]);
    });
  });

  describe('findAttachmentTarget', () => {
    test('finds registered attachable by string id', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let found = AttachmentTargetStore._findAttachmentTarget(instance.id);

      expect(found).toBe(instance);
    });

    test('throws error for non-existent id', () => {
      expect(() => {
        AttachmentTargetStore._findAttachmentTarget(9999);
      }).toThrow('Attachable: attachable not found by id! id: 9999');
    });
  });

  describe('unregisterIDAttachable', () => {
    test('removes attachable from store', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore._unregisterIDAttachable(instance);

      expect(() => {
        AttachmentTargetStore._findAttachmentTarget(id);
      }).toThrow(`Attachable: attachable not found by id! id: ${id}`);
    });

    test('allows reusing id after unregister and hardReset', () => {
      class TestClass extends IDAttachable {}

      let instance1 = new TestClass().attachToRoot();
      let firstID = instance1.id;
      AttachmentTargetStore._unregisterIDAttachable(instance1);

      AttachmentTargetStore._hardReset();

      let instance2 = new TestClass().attachToRoot();
      let secondID = instance2.id;

      expect(secondID).toBe(firstID);
    });
  });

  describe('validateIDForClass', () => {
    test('returns true for matching class', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let isValid = AttachmentTargetStore._validateIDForClass(instance.id, TestClass);

      expect(isValid).toBe(true);
    });

    test('returns false for non-matching class', () => {
      class TestClass1 extends IDAttachable {}
      class TestClass2 extends IDAttachable {}

      let instance = new TestClass1().attachToRoot();
      let isValid = AttachmentTargetStore._validateIDForClass(instance.id, TestClass2);

      expect(isValid).toBe(false);
    });

    test('returns false for non-existent id', () => {
      class TestClass extends IDAttachable {}

      let isValid = AttachmentTargetStore._validateIDForClass(9999, TestClass);

      expect(isValid).toBe(false);
    });

    test('validates correctly for derived classes', () => {
      class BaseClass extends IDAttachable {}
      class DerivedClass extends BaseClass {}

      let instance = new DerivedClass().attachToRoot();
      let isValidForDerived = AttachmentTargetStore._validateIDForClass(instance.id, DerivedClass);
      let isValidForBase = AttachmentTargetStore._validateIDForClass(instance.id, BaseClass);

      expect(isValidForDerived).toBe(true);
      expect(isValidForBase).toBe(false);
    });
  });

  describe('hardReset', () => {
    test('resets class id counter', () => {
      class TestClass1 extends IDAttachable {}
      class TestClass2 extends IDAttachable {}

      new TestClass1().attachToRoot();
      new TestClass2().attachToRoot();

      ActionLib.hardReset();

      class TestClass3 extends IDAttachable {}
      let instance = new TestClass3().attachToRoot();

      expect(instance.id).toBe(1);
    });

    test('resets instance id counters', () => {
      class TestClass extends IDAttachable {}

      new TestClass().attachToRoot();
      new TestClass().attachToRoot();

      AttachmentTargetStore._hardReset();

      let instance = new TestClass().attachToRoot();

      expect(instance.id).toBe(1);
    });

    test('clears all registered attachables', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore._hardReset();

      expect(() => {
        AttachmentTargetStore._findAttachmentTarget(id);
      }).toThrow(`Attachable: attachable not found by id! id: ${id}`);
    });

    test('clears class validation data', () => {
      class TestClass extends IDAttachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore._hardReset();

      let isValid = AttachmentTargetStore._validateIDForClass(id, TestClass);

      expect(isValid).toBe(false);
    });
  });

  describe('multiple classes interaction', () => {
    test('handles multiple classes with multiple instances each', () => {
      class ClassA extends IDAttachable {}
      class ClassB extends IDAttachable {}
      class ClassC extends IDAttachable {}

      let a1 = new ClassA().attachToRoot();
      let a2 = new ClassA().attachToRoot();
      let b1 = new ClassB().attachToRoot();
      let c1 = new ClassC().attachToRoot();
      let c2 = new ClassC().attachToRoot();
      let c3 = new ClassC().attachToRoot();

      expect([a1.id, a2.id, b1.id, c1.id, c2.id, c3.id]).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('finds correct instances after complex registration', () => {
      class ClassA extends IDAttachable {}
      class ClassB extends IDAttachable {}

      let a1 = new ClassA().attachToRoot();
      let b1 = new ClassB().attachToRoot();
      let a2 = new ClassA().attachToRoot();

      let foundA1 = AttachmentTargetStore._findAttachmentTarget(a1.id);
      let foundB1 = AttachmentTargetStore._findAttachmentTarget(b1.id);
      let foundA2 = AttachmentTargetStore._findAttachmentTarget(a2.id);

      expect(foundA1).toBe(a1);
      expect(foundB1).toBe(b1);
      expect(foundA2).toBe(a2);
    });
  });

  describe('edge cases', () => {
    test('handles rapid registration and unregistration', () => {
      class TestClass extends IDAttachable {}

      let instance1 = new TestClass().attachToRoot();
      let id1 = instance1.id;
      AttachmentTargetStore._unregisterIDAttachable(instance1);

      let instance2 = new TestClass().attachToRoot();
      let id2 = instance2.id;

      expect(id2).toBe(2);
      expect(() => {
        AttachmentTargetStore._findAttachmentTarget(id1);
      }).toThrow();
    });

    test('validates after partial unregistration', () => {
      class TestClass extends IDAttachable {}

      let instance1 = new TestClass().attachToRoot();
      let instance2 = new TestClass().attachToRoot();

      AttachmentTargetStore._unregisterIDAttachable(instance1);

      let isValid1 = AttachmentTargetStore._validateIDForClass(instance1.id, TestClass);
      let isValid2 = AttachmentTargetStore._validateIDForClass(instance2.id, TestClass);

      expect(isValid1).toBe(false);
      expect(isValid2).toBe(true);
    });
  });
});
