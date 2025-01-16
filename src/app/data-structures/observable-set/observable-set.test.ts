import { describe, expect, test } from 'vitest';
import { Wait } from 'helpers-lib';

import { ObservableSet } from './observable-set';

describe('ObservableSet', () => {
  test('should create an instance', () => {
    expect(new ObservableSet()).toBeTruthy();
  });

  test('should add a value', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    expect(set.size).toBe(1);
  });

  test('should remove a value', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    set.remove(1);
    expect(set.size).toBe(0);
  });

  test('should return waitUntilAddedSync if item is already added', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    let called = false;
    set.waitUntilAddedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilAddedSync if item is not added yet', () => {
    let set = new ObservableSet<number>();
    let called = false;
    set.waitUntilAddedSync(1, () => {
      called = true;
    });
    set.add(1);
    expect(called).toEqual(true);
  });

  test('should return waitUntilAdded if item is already added', async () => {
    let set = new ObservableSet<number>();
    set.add(1);
    expect(await set.waitUntilAdded(1)).toBeUndefined();
  });

  test('should return waitUntilAdded if item is not added yet', async () => {
    let set = new ObservableSet<number>();
    let called = false;
    set.waitUntilAdded(1).then(() => {
      called = true;
    });
    set.add(1);
    await Wait();
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is added', () => {
    let set = new ObservableSet<number>();
    let called = false;
    set.waitUntilRemovedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is already removed', () => {
    let set = new ObservableSet<number>();
    set.add(1);
    set.remove(1);
    let called = false;
    set.waitUntilRemovedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemoved if item is not added', async () => {
    let set = new ObservableSet<number>();
    expect(await set.waitUntilRemoved(1)).toBeUndefined();
  });

  test('should return waitUntilRemoved if item is already removed', async () => {
    let set = new ObservableSet<number>();
    let called = false;
    set.add(1);
    set.waitUntilRemoved(1).then(() => {
      called = true;
    });
    set.remove(1);
    await Wait();
    expect(called).toEqual(true);
  });
});
