import { takeNodeMinimalHeap } from '@memlab/core';
import { Wait } from 'helpers-lib';
import { describe, expect, test } from 'vitest';

import { Action } from '../observables/action/action';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Stream2 } from './stream';

describe('Memory Leak', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  test('no instance', async () => {
    new Action<string>();

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  });

  test('stream chaining', async () => {
    let stream = new Stream2<string>(resolve => {
      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value));
    }).map(
      data =>
        new Stream2<string>(resolve => {
          delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
        })
    );

    stream.destroy();
    await delayedCalls.waitForAllPromises();

    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  }, 30000);

  test('map chaining', async () => {
    let action1 = new Action<void>();
    let action2 = new Action<string>();

    let triggeredWith = '';
    let stream = action1
      .toStream()
      .map(() => action2)
      .map(data => data)
      .map(data => data)
      .map(data => {
        triggeredWith = data;
      })
      .attachToRoot();

    action1.trigger();
    await Wait();
    action2.trigger('a');

    expect(triggeredWith).toEqual('a');

    stream.destroy();
    action1 = undefined as any;
    action2 = undefined as any;
    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  }, 30000);

  test('stream waiting for action to complete cut in the middle', async () => {
    let action = new Action<void>();

    let stream = new Stream2<void>(resolve => resolve())
      .map(() => action) // Action will never resolve
      .attachToRoot();

    stream.destroy();
    action = undefined as any;
    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  }, 30000);

  test('stream waiting for stream to complete cut in the middle', async () => {
    let resolve!: () => void;

    let stream = new Stream2<void>(resolve => resolve())
      .map(
        () =>
          // This stream will never be resolved
          new Stream2<void>(r => {
            resolve = r;
          })
      )
      .attachToRoot();

    expect(resolve).toBeDefined();

    stream.destroy();
    resolve = undefined as any;
    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  }, 30000);

  test('stream and action complex', async () => {
    let action1 = new Action<string>();
    let action2 = new Action<string>();
    let action3 = new Action<string>();

    let heap: string[] = [];
    let stream = action1
      .map(a1 => action2.map(a2 => a1 + a2))
      .map(a2 =>
        new Stream2<string>(resolve => {
          delayedCalls.callEachDelayed(['a', 'b', 'c'], s1 => resolve(a2 + s1));
        }).map(s2 => action3.map(d3 => s2 + d3))
      )
      .map(data => {
        heap.push(data);
      })
      .attachToRoot();

    delayedCalls.callEachDelayed(['1', '2', '3'], value => {
      action1.trigger(value);
    });

    delayedCalls.callEachDelayed(['k', 'l', 'm'], value => {
      action2.trigger(value);
    });

    delayedCalls.callEachDelayed(['x', 'y', 'z', 'w'], value => {
      action3.trigger(value);
    });

    await delayedCalls.waitForAllPromises();
    expect(heap).toEqual(['1kay', '2laz', '3maw']);

    stream.destroy();
    action1 = undefined as any;
    action2 = undefined as any;
    action3 = undefined as any;
    stream = undefined as any;

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  }, 30000);
});
