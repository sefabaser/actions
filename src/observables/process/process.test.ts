import { beforeEach, describe, expect, test } from 'vitest';

import { SingleEvent } from '../../stream/single-event/single-event';
import { Process } from './process';

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

    test('instantly resolving registerers', () => {
      let singleEvent1!: SingleEvent<number>;
      let singleEvent2!: SingleEvent<number>;

      process
        .register(() => {
          singleEvent1 = SingleEvent.instant(1);
          return singleEvent1;
        })
        .attachToRoot();

      process
        .register(() => {
          singleEvent2 = SingleEvent.instant(2);
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

      expect(resolved).toBeTruthy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    // starting a process should throw error if there is an ongoing process
  });

  describe('registerer changes during the process', () => {
    test('unregistering a registerer in the middle of the process', () => {
      let resolve1!: (value: number) => void;

      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      let registerer2 = process.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(1);
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();
      expect(registerer2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      resolve1(1);
      expect(resolved).toBeFalsy();
      expect(registerer2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      registerer2.destroy();

      expect(resolved).toBeTruthy();
      expect(registerer2.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    test('new registerer appears during the process should not affect the process', () => {
      let resolve1!: (value: number) => void;

      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(1);
        })
        .attachToRoot();

      process.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      expect(resolved).toBeFalsy();

      resolve1(1);

      expect(resolved).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    test('new registerer appears and then unregisters a the process', () => {
      let resolve1!: (value: number) => void;

      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(1);
        })
        .attachToRoot();

      let newRegisterer = process.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();
      newRegisterer.destroy();

      expect(resolved).toBeFalsy();

      resolve1(1);

      expect(resolved).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    test('resolved registerer being destroyed during the process', () => {
      let resolve1!: (value: number) => void;
      let resolve2!: (value: number) => void;

      let registerer1 = process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve2 = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(3);
        })
        .attachToRoot();

      resolve1(1);
      expect(resolved).toBeFalsy();

      registerer1.destroy();
      expect(resolved).toBeFalsy();

      resolve2(2);

      expect(resolved).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });
  });
});
