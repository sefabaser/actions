import { beforeEach, describe, expect, test } from 'vitest';

import { ActionLibUnitTestHelper } from '../../helpers/unit-test.helper';
import { Attachable } from '../attachable';
import { AttachmentTargetStore } from './attachment-target.store';
import { ClassId } from './class-id';

describe('AttachmentTargetStore', () => {
  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('registerAttachmentTarget', () => {
    test('generates unique id for single instance', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      expect(id).toBe('1:1');
    });

    test('generates sequential ids for multiple instances of same class', () => {
      class TestClass extends Attachable {}

      let instance1 = new TestClass().attachToRoot();
      let instance2 = new TestClass().attachToRoot();
      let instance3 = new TestClass().attachToRoot();

      expect([instance1.id, instance2.id, instance3.id]).toEqual(['1:1', '1:2', '1:3']);
    });

    test('generates different class ids for different classes', () => {
      class TestClass1 extends Attachable {}
      class TestClass2 extends Attachable {}

      let instance1 = new TestClass1().attachToRoot();
      let instance2 = new TestClass2().attachToRoot();

      expect(instance1.id).toBe('1:1');
      expect(instance2.id).toBe('2:1');
    });

    test('maintains separate numbering for different classes', () => {
      class TestClass1 extends Attachable {}
      class TestClass2 extends Attachable {}

      let instance1a = new TestClass1().attachToRoot();
      let instance2a = new TestClass2().attachToRoot();
      let instance1b = new TestClass1().attachToRoot();
      let instance2b = new TestClass2().attachToRoot();

      expect([instance1a.id, instance2a.id, instance1b.id, instance2b.id]).toEqual(['1:1', '2:1', '1:2', '2:2']);
    });
  });

  describe('findAttachmentTarget', () => {
    test('finds registered attachable by string id', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let found = AttachmentTargetStore.findAttachmentTarget(instance.id);

      expect(found).toBe(instance);
    });

    test('returns same object when passed an Attachable instance', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let found = AttachmentTargetStore.findAttachmentTarget(instance);

      expect(found).toBe(instance);
    });

    test('throws error for non-existent id', () => {
      expect(() => {
        AttachmentTargetStore.findAttachmentTarget('999:999');
      }).toThrow('Attachable: attachable not found by id! id: 999:999');
    });

    test('throws error for empty string id', () => {
      expect(() => {
        AttachmentTargetStore.findAttachmentTarget('');
      }).toThrow('Attachable: attachable not found by id! id: ');
    });
  });

  describe('unregisterAttachmentTarget', () => {
    test('removes attachable from store', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore.unregisterAttachmentTarget(instance);

      expect(() => {
        AttachmentTargetStore.findAttachmentTarget(id);
      }).toThrow(`Attachable: attachable not found by id! id: ${id}`);
    });

    test('allows reusing id after unregister and hardReset', () => {
      class TestClass extends Attachable {}

      let instance1 = new TestClass().attachToRoot();
      let firstId = instance1.id;
      AttachmentTargetStore.unregisterAttachmentTarget(instance1);

      AttachmentTargetStore.hardReset();

      let instance2 = new TestClass().attachToRoot();
      let secondId = instance2.id;

      expect(secondId).toBe(firstId);
    });
  });

  describe('validateIdForClass', () => {
    test('returns true for matching class', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let isValid = AttachmentTargetStore.validateIdForClass(instance.id, TestClass);

      expect(isValid).toBe(true);
    });

    test('returns false for non-matching class', () => {
      class TestClass1 extends Attachable {}
      class TestClass2 extends Attachable {}

      let instance = new TestClass1().attachToRoot();
      let isValid = AttachmentTargetStore.validateIdForClass(instance.id, TestClass2);

      expect(isValid).toBe(false);
    });

    test('returns false for non-existent id', () => {
      class TestClass extends Attachable {}

      let isValid = AttachmentTargetStore.validateIdForClass('999:999', TestClass);

      expect(isValid).toBe(false);
    });

    test('validates correctly for derived classes', () => {
      class BaseClass extends Attachable {}
      class DerivedClass extends BaseClass {}

      let instance = new DerivedClass().attachToRoot();
      let isValidForDerived = AttachmentTargetStore.validateIdForClass(instance.id, DerivedClass);
      let isValidForBase = AttachmentTargetStore.validateIdForClass(instance.id, BaseClass);

      expect(isValidForDerived).toBe(true);
      expect(isValidForBase).toBe(false);
    });
  });

  describe('hardReset', () => {
    test('resets class id counter', () => {
      class TestClass1 extends Attachable {}
      class TestClass2 extends Attachable {}

      new TestClass1().attachToRoot();
      new TestClass2().attachToRoot();

      ClassId.hardReset();
      AttachmentTargetStore.hardReset();

      class TestClass3 extends Attachable {}
      let instance = new TestClass3().attachToRoot();

      expect(instance.id).toBe('1:1');
    });

    test('resets instance id counters', () => {
      class TestClass extends Attachable {}

      new TestClass().attachToRoot();
      new TestClass().attachToRoot();

      AttachmentTargetStore.hardReset();

      let instance = new TestClass().attachToRoot();

      expect(instance.id).toBe('1:1');
    });

    test('clears all registered attachables', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore.hardReset();

      expect(() => {
        AttachmentTargetStore.findAttachmentTarget(id);
      }).toThrow(`Attachable: attachable not found by id! id: ${id}`);
    });

    test('clears class validation data', () => {
      class TestClass extends Attachable {}

      let instance = new TestClass().attachToRoot();
      let id = instance.id;

      AttachmentTargetStore.hardReset();

      let isValid = AttachmentTargetStore.validateIdForClass(id, TestClass);

      expect(isValid).toBe(false);
    });
  });

  describe('multiple classes interaction', () => {
    test('handles multiple classes with multiple instances each', () => {
      class ClassA extends Attachable {}
      class ClassB extends Attachable {}
      class ClassC extends Attachable {}

      let a1 = new ClassA().attachToRoot();
      let a2 = new ClassA().attachToRoot();
      let b1 = new ClassB().attachToRoot();
      let c1 = new ClassC().attachToRoot();
      let c2 = new ClassC().attachToRoot();
      let c3 = new ClassC().attachToRoot();

      expect([a1.id, a2.id, b1.id, c1.id, c2.id, c3.id]).toEqual(['1:1', '1:2', '2:1', '3:1', '3:2', '3:3']);
    });

    test('finds correct instances after complex registration', () => {
      class ClassA extends Attachable {}
      class ClassB extends Attachable {}

      let a1 = new ClassA().attachToRoot();
      let b1 = new ClassB().attachToRoot();
      let a2 = new ClassA().attachToRoot();

      let foundA1 = AttachmentTargetStore.findAttachmentTarget(a1.id);
      let foundB1 = AttachmentTargetStore.findAttachmentTarget(b1.id);
      let foundA2 = AttachmentTargetStore.findAttachmentTarget(a2.id);

      expect(foundA1).toBe(a1);
      expect(foundB1).toBe(b1);
      expect(foundA2).toBe(a2);
    });
  });

  describe('edge cases', () => {
    test('handles rapid registration and unregistration', () => {
      class TestClass extends Attachable {}

      let instance1 = new TestClass().attachToRoot();
      let id1 = instance1.id;
      AttachmentTargetStore.unregisterAttachmentTarget(instance1);

      let instance2 = new TestClass().attachToRoot();
      let id2 = instance2.id;

      expect(id2).toBe('1:2');
      expect(() => {
        AttachmentTargetStore.findAttachmentTarget(id1);
      }).toThrow();
    });

    test('validates after partial unregistration', () => {
      class TestClass extends Attachable {}

      let instance1 = new TestClass().attachToRoot();
      let instance2 = new TestClass().attachToRoot();

      AttachmentTargetStore.unregisterAttachmentTarget(instance1);

      let isValid1 = AttachmentTargetStore.validateIdForClass(instance1.id, TestClass);
      let isValid2 = AttachmentTargetStore.validateIdForClass(instance2.id, TestClass);

      expect(isValid1).toBe(false);
      expect(isValid2).toBe(true);
    });
  });
});
