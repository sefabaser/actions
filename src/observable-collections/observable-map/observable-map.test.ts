import { describe, expect, test } from 'vitest';

import { ObservableMap } from './observable-map';

describe('ObservableMap', () => {
  test('should create an instance', () => {
    expect(new ObservableMap()).toBeTruthy();
  });

  test('should create an instance with a map', () => {
    let map = new ObservableMap(new Map<number, string>([[1, 'test']]));
    map.set(2, 'test2');

    expect(map.size).toBe(2);
    expect(map.convertToMap()).toEqual(
      new Map<number, string>([
        [1, 'test'],
        [2, 'test2']
      ])
    );
  });

  test('should set a value', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    expect(set.size).toBe(1);
  });

  test('should delete a value', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    set.delete(1);
    expect(set.size).toBe(0);
  });

  test('should return waitUntilAddedSync if item is already set', () => {
    let set = new ObservableMap<number, string>();
    set.set(1, 'test');
    let called = false;
    set.waitUntilAdded(1).read(() => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilAddedSync if item is not set yet', () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set
      .waitUntilAdded(1)
      .read(() => {
        called = true;
      })
      .attachToRoot();
    set.set(1, 'test');
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is not set', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.waitUntilRemoved(1).read(() => {
      called = true;
    });
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is already deleted', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.set(1, 'test');
    set.delete(1);
    set.waitUntilRemoved(1).read(() => {
      called = true;
    });
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
