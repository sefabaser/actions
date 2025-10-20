import { describe, expect, test } from 'vitest';

import { ClassId } from './class-id';

describe('ClassId', () => {
  test('each class gets unique ID', () => {
    class Child1 extends ClassId {}
    class Child2 extends ClassId {}

    let classIdId = ClassId.id;
    let child1Id = Child1.id;
    let child2Id = Child2.id;

    expect(new Set([classIdId, child1Id, child2Id]).size).toBe(3);
  });

  test('instance classId matches static class id', () => {
    class Child1 extends ClassId {}
    class Child2 extends ClassId {}

    let child1 = new Child1();
    let child2 = new Child2();

    expect(child1.classId).toBe(Child1.id);
    expect(child2.classId).toBe(Child2.id);
  });

  test('different instances of the same class have consistent classIds', () => {
    class Child1 extends ClassId {}
    let child1 = new Child1();
    let child2 = new Child1();
    expect(child1.classId).toBe(child2.classId);
  });

  test('middle class should be able to access instance classId of its children', () => {
    class Mid extends ClassId {
      foo(instance: Mid): string {
        return instance.classId;
      }
    }

    class Child1 extends Mid {}
    class Child2 extends Mid {}

    let child1 = new Child1();
    let child2 = new Child2();

    expect(child1.foo(child2)).toBe(child2.classId);
    expect(child2.foo(child1)).toBe(child1.classId);
  });

  test('hardReset', () => {
    ClassId.hardReset();
    class Child1 extends ClassId {}
    expect(Child1.id).toBe('1');
    ClassId.hardReset();
    class Child2 extends ClassId {}
    expect(Child2.id).toBe('1');
  });
});
