import { Wait } from 'helpers-lib';
import { describe, expect, test } from 'vitest';

import { ObservableMap } from './observable-map';

describe('ObservableMap', () => {
  test('should create an instance', () => {
    expect(new ObservableMap()).toBeTruthy();
  });

  test('should set a value', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    expect(set.size).toBe(1);
  });

  test('should remove a value', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    set.remove(1);
    expect(set.size).toBe(0);
  });

  test('should return waitUntilAddedSync if item is already set', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    let called = false;
    set.waitUntilAddedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilAddedSync if item is not set yet', () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.waitUntilAddedSync(1, () => {
      called = true;
    });
    set.set(1, 'test');
    expect(called).toEqual(true);
  });

  test('should return waitUntilAdded if item is already set', async () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    expect(await set.waitUntilAdded(1)).toEqual('test');
  });

  test('should return waitUntilAdded if item is not set yet', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.waitUntilAdded(1).then(() => {
      called = true;
    });
    set.set(1, 'test');
    await Wait();
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is not set', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.waitUntilRemovedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is already removed', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.set(1, 'test');
    set.remove(1);
    set.waitUntilRemovedSync(1, () => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemoved if item is not set', async () => {
    let set = new ObservableMap<number, string>();
    expect(await set.waitUntilRemoved(1)).toBeUndefined();
  });

  test('should return waitUntilRemoved if item is already removed', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.set(1, 'test');
    set.waitUntilRemoved(1).then(() => {
      called = true;
    });
    set.remove(1);
    await Wait();
    expect(called).toEqual(true);
  });

  test('should convert to map', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    expect(set.convertToMap()).toEqual(new Map([[1, 'test']]));
  });

  test('should conveted map should not change the original map', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    let map = set.convertToMap();
    map.set(2, 'test2');
    expect(set.convertToMap()).toEqual(new Map([[1, 'test']]));
  });
});
