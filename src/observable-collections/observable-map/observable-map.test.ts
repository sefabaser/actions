import { describe, expect, test } from 'vitest';

import { Attachable } from '../../attachable/attachable';
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
    set
      .waitUntilAdded(1)
      .tap(() => {
        called = true;
      })
      .attachToRoot();
    expect(called).toEqual(true);
  });

  test('should return waitUntilAddedSync if item is not set yet', () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set
      .waitUntilAdded(1)
      .tap(() => {
        called = true;
      })
      .attachToRoot();
    set.set(1, 'test');
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is not set', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set
      .waitUntilRemoved(1)
      .tap(() => {
        called = true;
      })
      .attachToRoot();
    expect(called).toEqual(true);
  });

  test('should return waitUntilRemovedSync if item is already deleted', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.set(1, 'test');
    set.delete(1);
    set
      .waitUntilRemoved(1)
      .tap(() => {
        called = true;
      })
      .attachToRoot();
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

  describe('Race conditions', () => {
    test(`subscription destroying another subscription's parent`, () => {
      let set = new ObservableMap<number, string>();

      class Foo extends Attachable {
        foo = { x: 1 };

        destroy(): void {
          super.destroy();
          this.foo = undefined as any;
        }
      }

      let parent = new Foo().attachToRoot();

      let triggered1 = false;
      let triggered2 = false;

      set
        .waitUntilAdded(1)
        .tap(() => {
          triggered1 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      set
        .waitUntilAdded(1)
        .tap(() => {
          triggered2 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      expect(() => set.set(1, 'a')).not.throw();
      expect(triggered1).toBeTruthy();
      expect(triggered2).toBeFalsy();
    });

    test(`new subscriber should not be directly executed if it is created by another subscriber`, () => {
      let set = new ObservableMap<number, string>();

      let triggered1 = false;
      let triggered2 = false;

      set
        .waitUntilAdded(1)
        .tap(() => {
          triggered1 = true;
          set.delete(1);
          set
            .waitUntilAdded(1) // set does not have 1 at this moment
            .tap(() => {
              triggered2 = true;
            })
            .attachToRoot();
        })
        .attachToRoot();

      expect(() => set.set(1, 'a')).not.throw();
      expect(triggered1).toBeTruthy();
      expect(triggered2).toBeFalsy();
    });
  });
});
