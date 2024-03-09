import { Wait } from 'helpers-lib';
import { ObservableMap } from './observable-map';

describe('ObservableMap', () => {
  it('should create an instance', () => {
    expect(new ObservableMap()).toBeTruthy();
  });

  it('should add a value', () => {
    let set = new ObservableMap<number, string>();
    set.add(1, 'test');
    expect(set.size).toBe(1);
  });

  it('should remove a value', () => {
    let set = new ObservableMap<number, string>();
    set.add(1, 'test');
    set.remove(1);
    expect(set.size).toBe(0);
  });

  it('should return waitUntilAdded if item is already added', async () => {
    let set = new ObservableMap<number, string>();
    set.add(1, 'test');
    expect(await set.waitUntilAdded(1)).toEqual('test');
  });

  it('should return waitUntilAdded if item is not added', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.waitUntilAdded(1).then(() => {
      called = true;
    });
    set.add(1, 'test');
    await Wait();
    expect(called).toEqual(true);
  });

  it('should return waitUntilRemoved if item is not added', async () => {
    let set = new ObservableMap<number, string>();
    expect(await set.waitUntilRemoved(1)).toBeUndefined();
  });

  it('should return waitUntilRemoved if item is already added', async () => {
    let set = new ObservableMap<number, string>();
    let called = false;
    set.add(1, 'test');
    set.waitUntilRemoved(1).then(() => {
      called = true;
    });
    set.remove(1);
    await Wait();
    expect(called).toEqual(true);
  });
});
