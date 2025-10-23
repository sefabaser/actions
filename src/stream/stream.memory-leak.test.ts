import { takeNodeMinimalHeap } from '@memlab/core';
import { expect, test } from 'vitest';

import { Stream2 } from './stream';

class Publisher {
  callbacks: (() => void)[] = [];

  subscribe(callback: () => void): void {
    this.callbacks.push(callback);
  }
}

class Subscriber {
  constructor(private publisher: Publisher) {
    this.publisher.subscribe(() => {
      this; // triggers memmory leak
    });
  }
}

test('detects memory leak', async () => {
  let publisher = new Publisher();
  new Subscriber(publisher);

  let snapshot = await takeNodeMinimalHeap();
  let leaked = snapshot.hasObjectWithClassName(Subscriber.name);

  expect(snapshot.hasObjectWithClassName(Stream2.name)).toBeFalsy();
  expect(leaked).toBeFalsy();
});
