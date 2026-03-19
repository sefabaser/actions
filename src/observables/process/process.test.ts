import { beforeEach, describe, expect, test } from 'vitest';

import { SingleEvent } from '../../stream/single-event/single-event';
import { Process } from './process';

// no registerers on start
// all registerers instantly resolves

// registerer unregisters in the middle of the process
// during the process a new registerer appears
// during a process a new registerer appears and then unregisters
// during a process a resolved registerer being destroyed

// destroying the process should destroy all listener processes
// destroying the process after one child listener destroyed should destroy the remaining children

describe('Process', () => {
  let process: Process<number, number, number>;

  beforeEach(() => {
    process = new Process<number, number, number>((acc, value) => acc + value, 0);
  });

  describe('setup', () => {
    test('defined', () => {
      expect(process).toBeDefined();
    });

    test('starting the process without registerer', () => {
      let event = process.start(1).attachToRoot();
      expect(event).toBeDefined();
    });

    test('registering a listener', () => {
      let subscription = process.register(() => SingleEvent.instant(1)).attachToRoot();
      expect(subscription).toBeDefined();
    });

    test('process should return the default value when no registerers are present', () => {
      let resolved = false;

      process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(0);
        })
        .attachToRoot();

      expect(resolved).toBeTruthy();
    });
  });

  describe('basic behavior', () => {
    test('single registerer', () => {
      let resolve!: (value: number) => void;
      let singleEvent!: SingleEvent<number>;

      process
        .register(() => {
          singleEvent = SingleEvent.create<number>(r => {
            resolve = r;
          });
          return singleEvent;
        })
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(1);
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();

      resolve(1);
      expect(resolved).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    test('multiple registerers', () => {
      let resolve1!: (value: number) => void;
      let singleEvent1!: SingleEvent<number>;
      let resolve2!: (value: number) => void;
      let singleEvent2!: SingleEvent<number>;

      process
        .register(() => {
          singleEvent1 = SingleEvent.create<number>(r => {
            resolve1 = r;
          });
          return singleEvent1;
        })
        .attachToRoot();

      process
        .register(() => {
          singleEvent2 = SingleEvent.create<number>(r => {
            resolve2 = r;
          });
          return singleEvent2;
        })
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(3);
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();
      expect(singleEvent1.destroyed).toBeFalsy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      resolve1(1);
      expect(resolved).toBeFalsy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      resolve2(2);

      expect(resolved).toBeTruthy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });
  });
});
