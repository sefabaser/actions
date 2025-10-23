import { takeNodeMinimalHeap } from '@memlab/core';
import { Wait } from 'helpers-lib';
import { describe, expect, test } from 'vitest';

import { Action } from '../observables/action/action';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Stream2 } from './stream';

describe('Memory Leak', () => {
  test('no instance', async () => {
    new Action<string>();

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  });

  test('tap chaining', async () => {
    let action = new Action<string>();

    let triggeredWith = '';
    let stream = action
      .toStream()
      .tap(data => data)
      .tap(data => data)
      .tap(data => data)
      .tap(data => {
        triggeredWith = data;
      })
      .attachToRoot();

    action.trigger('a');
    expect(triggeredWith).toEqual('a');

    stream.destroy();
    action = undefined as any;
    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  });

  test('stream and action', async () => {
    let helper = new DelayedSequentialCallsHelper();

    let action = new Action<string>();
    let foo = (data: string) => {
      return new Stream2<string>(resolve => {
        helper.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
      });
    };

    let stream = action.tap(data => foo(data)).attachToRoot();

    helper.callEachDelayed(['1', '2', '3'], value => {
      action.trigger(value);
    });

    await helper.waitForAllPromises();

    stream.destroy();
    action = undefined as any;
    stream = undefined as any;
    await Wait(); // Attachment check still keeps the reference, wait for one timeout

    let snapshot = await takeNodeMinimalHeap();
    expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
    expect(snapshot.hasObjectWithClassName(Action.name)).toBeFalsy();
  });
});
