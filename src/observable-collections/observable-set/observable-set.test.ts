import { describe, expect, test } from 'vitest';

import { ObservableSet } from './observable-set';

describe('ObservableSet', () => {
  test('should create an instance', () => {
    expect(new ObservableSet()).toBeTruthy();
  });

  test('should create an instance with a set', () => {
    let set = new ObservableSet(new Set<number>([1]));
    set.add(2);
    expect(set.convertToSet()).toEqual(new Set([1, 2]));
  });

  test('should add a value', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    expect(set.size).toBe(1);
  });

  test('should delete a value', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    set.delete(1);
    expect(set.size).toBe(0);
  });

  test('should return waitUntilAddedSync if item is already added', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    let called = false;
    set
      .waitUntilAdded(1)
      .read(() => {
        called = true;
      })
      .attachToRoot();
    expect(called).toEqual(true);
  });

  test('should return waitUntilAddedSync if item is not added yet', () => {
    let set = new ObservableSet<number>();
    let called = false;
    set
      .waitUntilAdded(1)
      .read(() => {
        called = true;
      })
      .attachToRoot();
    set.add(1);
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is added', () => {
    let set = new ObservableSet<number>();
    let called = false;
    set
      .waitUntilRemoved(1)
      .read(() => {
        called = true;
      })
      .attachToRoot();
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is already deleted', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    set.delete(1);
    let called = false;
    set
      .waitUntilRemoved(1)
      .read(() => {
        called = true;
      })
      .attachToRoot();
    expect(called).toEqual(true);
  });

  test('should convert to set', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    expect(set.convertToSet()).toEqual(new Set([1]));
  });

  test('should conveted set should not change the original set', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    let set2 = set.convertToSet();
    set2.add(2);
    expect(set.convertToSet()).toEqual(new Set([1]));
  });
});
