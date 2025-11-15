import { describe, expect, test } from 'vitest';

import { ClassID } from './class-id';

describe('ClassID', () => {
  describe('Direct Inheritance', () => {
    test('each class gets unique ID', () => {
      class Child1 extends ClassID {}
      class Child2 extends ClassID {}

      let classIDID = ClassID.id;
      let child1ID = Child1.id;
      let child2ID = Child2.id;

      expect(new Set([classIDID, child1ID, child2ID]).size).toBe(3);
    });

    test('instance classID matches static class id', () => {
      class Child1 extends ClassID {}
      class Child2 extends ClassID {}

      let child1 = new Child1();
      let child2 = new Child2();

      expect(child1.classID).toBe(Child1.id);
      expect(child2.classID).toBe(Child2.id);
    });

    test('different instances of the same class have consistent classIDs', () => {
      class Child1 extends ClassID {}
      let child1 = new Child1();
      let child2 = new Child1();
      expect(child1.classID).toBe(child2.classID);
    });

    test('middle class should be able to access instance classID of its children', () => {
      class Mid extends ClassID {
        foo(instance: Mid): number {
          return instance.classID;
        }
      }

      class Child1 extends Mid {}
      class Child2 extends Mid {}

      let child1 = new Child1();
      let child2 = new Child2();

      expect(child1.foo(child2)).toBe(child2.classID);
      expect(child2.foo(child1)).toBe(child1.classID);
    });

    test('same name but different classes should have different ids', () => {
      let getClass: () => typeof ClassID = () => {
        return class Foo extends ClassID {};
      };

      let class1 = getClass();
      let class2 = getClass();

      expect(class1.id).not.toEqual(class2.id);
    });

    test('hardReset', () => {
      ClassID._hardReset();
      class Child1 extends ClassID {}
      expect(Child1.id).toBe(1);
      ClassID._hardReset();
      class Child2 extends ClassID {}
      expect(Child2.id).toBe(1);
    });
  });

  describe('Without Inheritance', () => {
    class Foo {
      static get id(): number {
        return ClassID.getClassID(this);
      }

      get classID(): number {
        return (this.constructor as typeof Foo).id;
      }
    }

    test('each class gets unique ID', () => {
      class Child1 extends Foo {}
      class Child2 extends Foo {}

      let classIDID = Foo.id;
      let child1ID = Child1.id;
      let child2ID = Child2.id;

      expect(new Set([classIDID, child1ID, child2ID]).size).toBe(3);
    });

    test('instance classID matches static class id', () => {
      class Child1 extends Foo {}
      class Child2 extends Foo {}

      let child1 = new Child1();
      let child2 = new Child2();

      expect(child1.classID).toBe(Child1.id);
      expect(child2.classID).toBe(Child2.id);
    });

    test('different instances of the same class have consistent classIDs', () => {
      class Child1 extends Foo {}
      let child1 = new Child1();
      let child2 = new Child1();
      expect(child1.classID).toBe(child2.classID);
    });

    test('middle class should be able to access instance classID of its children', () => {
      class Mid extends Foo {
        foo(instance: Mid): number {
          return instance.classID;
        }
      }

      class Child1 extends Mid {}
      class Child2 extends Mid {}

      let child1 = new Child1();
      let child2 = new Child2();

      expect(child1.foo(child2)).toBe(child2.classID);
      expect(child2.foo(child1)).toBe(child1.classID);
    });

    test('same name but different classes should have different ids', () => {
      let getClass: () => typeof Foo = () => {
        return class Foo2 extends Foo {};
      };

      let class1 = getClass();
      let class2 = getClass();

      expect(class1.id).not.toEqual(class2.id);
    });

    test('hardReset', () => {
      ClassID._hardReset();
      class Child1 extends Foo {}
      expect(Child1.id).toBe(1);
      ClassID._hardReset();
      class Child2 extends Foo {}
      expect(Child2.id).toBe(1);
    });
  });
});
