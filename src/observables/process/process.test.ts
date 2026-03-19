import { beforeEach, describe, expect, test } from 'vitest';

import { SingleEvent } from '../../stream/single-event/single-event';
import { Process } from './process';

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

    test('"running" property should be true when a process is ongoing', () => {
      let resolve!: (value: number) => void;
      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      let resolvedWith: number | undefined;
      process
        .start(1)
        .tap(value => {
          resolved = true;
          resolvedWith = value;
        })
        .attachToRoot();

      expect(process.running).toBeTruthy();
      expect(resolved).toBeFalsy();
      expect(resolvedWith).toBeUndefined();

      resolve(1);
      expect(resolved).toBeTruthy();
      expect(resolvedWith).toBe(1);
      expect(process.running).toBeFalsy();
    });
  });

  describe('basic behavior', () => {
    test('single registerer', () => {
      let resolve!: (value: number) => void;
      process
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(1);
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();

      resolve(1);
      expect(resolved).toBeTruthy();
    });

    test('multiple registerers', () => {
      let resolve1!: (value: number) => void;
      let resolve2!: (value: number) => void;

      process
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
      process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(3);
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();

      resolve1(1);
      expect(resolved).toBeFalsy();

      resolve2(2);

      expect(resolved).toBeTruthy();
    });

    test('instantly resolving registerers', () => {
      process.register(() => SingleEvent.instant(1)).attachToRoot();
      process.register(() => SingleEvent.instant(2)).attachToRoot();

      let resolved = false;
      process
        .start(1)
        .tap(value => {
          resolved = true;
          expect(value).toBe(3);
        })
        .attachToRoot();

      expect(resolved).toBeTruthy();
    });

    test('multiple processes running one after another', () => {
      let resolve1!: (value: number) => void;
      let resolve2!: (value: number) => void;

      process
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
      let result: number | undefined;
      process
        .start(1)
        .tap(value => {
          resolved = true;
          result = value;
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();
      resolve1(1);
      expect(resolved).toBeFalsy();
      resolve2(2);
      expect(resolved).toBeTruthy();
      expect(result).toBe(3);

      resolved = false;
      result = undefined;

      process
        .start(1)
        .tap(value => {
          resolved = true;
          result = value;
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();
      resolve1(3);
      expect(resolved).toBeFalsy();
      resolve2(4);
      expect(resolved).toBeTruthy();
      expect(result).toBe(7);
    });

    test('all registerers receive broadcasted value during starting the process', () => {
      let receivedValues: number[] = [];

      process
        .register(data => {
          receivedValues.push(data);
          return SingleEvent.instant(data);
        })
        .attachToRoot();

      process
        .register(data => {
          receivedValues.push(data);
          return SingleEvent.instant(data);
        })
        .attachToRoot();

      process.start(5).attachToRoot();

      expect(receivedValues).toEqual([5, 5]);
    });
  });

  describe('registerer changes during on process', () => {
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

  describe('desctruction', () => {
    test('when all registerers complete the process should be destroyed', () => {
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
        .tap(_ => (resolved = true))
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

    test('destroying all registerers should complete the process', () => {
      let singleEvent1!: SingleEvent<number>;
      let singleEvent2!: SingleEvent<number>;

      process
        .register(() => {
          singleEvent1 = SingleEvent.create<number>(_ => {});
          return singleEvent1;
        })
        .attachToRoot();

      process
        .register(() => {
          singleEvent2 = SingleEvent.create<number>(_ => {});
          return singleEvent2;
        })
        .attachToRoot();

      let resolved = false;
      let processOperation = process
        .start(1)
        .tap(_ => (resolved = true))
        .attachToRoot();

      expect(resolved).toBeFalsy();
      expect(singleEvent1.destroyed).toBeFalsy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      singleEvent1.destroy();
      expect(resolved).toBeFalsy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      singleEvent2.destroy();

      expect(resolved).toBeTruthy();
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });

    test('destroying a process destroys all listener processes', () => {
      let singleEvent1!: SingleEvent<number>;
      let singleEvent2!: SingleEvent<number>;

      process
        .register(() => {
          singleEvent1 = SingleEvent.create<number>(_ => {});
          return singleEvent1;
        })
        .attachToRoot();

      process
        .register(() => {
          singleEvent2 = SingleEvent.create<number>(_ => {});
          return singleEvent2;
        })
        .attachToRoot();

      let processOperation = process.start(1).attachToRoot();

      expect(singleEvent1.destroyed).toBeFalsy();
      expect(singleEvent2.destroyed).toBeFalsy();

      processOperation.destroy();

      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
    });

    test('destroying a process after one child listener destroyed destroys the remaining children', () => {
      let resolve1!: (value: number) => void;
      let singleEvent1!: SingleEvent<number>;
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
          singleEvent2 = SingleEvent.create<number>(_ => {});
          return singleEvent2;
        })
        .attachToRoot();

      let processOperation = process.start(1).attachToRoot();

      resolve1(1);
      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeFalsy();

      processOperation.destroy();

      expect(singleEvent2.destroyed).toBeTruthy();
    });
  });

  describe('error handling', () => {
    test('starting a process throws error if there is an ongoing process', () => {
      process.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      process.start(1).attachToRoot();

      expect(() => process.start(1).attachToRoot()).toThrow(
        'Process: cannot start a new process while an ongoing process is still ongoing.'
      );
    });
  });

  describe('createAll', () => {
    test('not finish before all registerers have resolved', () => {
      let allProcess = Process.createAll<number>();
      let resolve1!: () => void;

      allProcess
        .register(() =>
          SingleEvent.create<void>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      allProcess.register(() => SingleEvent.create<void>(_ => {})).attachToRoot();

      let resolved = false;
      allProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();

      resolve1();
      expect(resolved).toBeFalsy();
    });

    test('not finish if one registerer is destroyed', () => {
      let allProcess = Process.createAll<number>();

      allProcess.register(() => SingleEvent.create<void>(_ => {})).attachToRoot();

      let registerer2 = allProcess.register(() => SingleEvent.create<void>(_ => {})).attachToRoot();

      let resolved = false;
      allProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      registerer2.destroy();
      expect(resolved).toBeFalsy();
    });

    test('not finish if the process is destroyed', () => {
      let allProcess = Process.createAll<number>();

      allProcess.register(() => SingleEvent.create<void>(_ => {})).attachToRoot();

      let resolved = false;
      let processOperation = allProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      processOperation.destroy();
      expect(resolved).toBeFalsy();
    });

    test('finish when all registerers have resolved', () => {
      let allProcess = Process.createAll<number>();
      let resolve1!: () => void;
      let resolve2!: () => void;

      allProcess
        .register(() =>
          SingleEvent.create<void>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      allProcess
        .register(() =>
          SingleEvent.create<void>(r => {
            resolve2 = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      allProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      resolve1();
      expect(resolved).toBeFalsy();

      resolve2();
      expect(resolved).toBeTruthy();
    });
  });

  describe('createAny', () => {
    test('not resolve if none of the registerers have resolved', () => {
      let anyProcess = Process.createAny<number, number>();

      anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();
      anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      let resolved = false;
      anyProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();
    });

    test('not resolve if one registerer is destroyed', () => {
      let anyProcess = Process.createAny<number, number>();

      anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();
      let registerer2 = anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      let resolved = false;
      anyProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      registerer2.destroy();
      expect(resolved).toBeFalsy();
    });

    test('not resolve if the process is destroyed', () => {
      let anyProcess = Process.createAny<number, number>();

      anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      let resolved = false;
      let processOperation = anyProcess
        .start(1)
        .tap(() => {
          resolved = true;
        })
        .attachToRoot();

      processOperation.destroy();
      expect(resolved).toBeFalsy();
    });

    test('resolve when the first registerer resolves', () => {
      let anyProcess = Process.createAny<number, number>();
      let resolve1!: (value: number) => void;

      anyProcess
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      anyProcess.register(() => SingleEvent.create<number>(_ => {})).attachToRoot();

      let resolved = false;
      let result: number | undefined;
      anyProcess
        .start(1)
        .tap(value => {
          resolved = true;
          result = value;
        })
        .attachToRoot();

      expect(resolved).toBeFalsy();

      resolve1(42);

      expect(resolved).toBeTruthy();
      expect(result).toBe(42);
    });

    test('once one registerer resolves, the process and other remaining registerers are destroyed', () => {
      let anyProcess = Process.createAny<number, number>();
      let resolve1!: (value: number) => void;
      let singleEvent1!: SingleEvent<number>;
      let singleEvent2!: SingleEvent<number>;

      anyProcess
        .register(() => {
          singleEvent1 = SingleEvent.create<number>(r => {
            resolve1 = r;
          });
          return singleEvent1;
        })
        .attachToRoot();

      anyProcess
        .register(() => {
          singleEvent2 = SingleEvent.create<number>(_ => {});
          return singleEvent2;
        })
        .attachToRoot();

      let processOperation = anyProcess.start(1).attachToRoot();

      expect(singleEvent1.destroyed).toBeFalsy();
      expect(singleEvent2.destroyed).toBeFalsy();
      expect(processOperation.destroyed).toBeFalsy();

      resolve1(42);

      expect(singleEvent1.destroyed).toBeTruthy();
      expect(singleEvent2.destroyed).toBeTruthy();
      expect(processOperation.destroyed).toBeTruthy();
    });
  });

  describe('createSum', () => {
    test('return the sum of all resolved registerers', () => {
      let sumProcess = Process.createSum<number>();
      let resolve1!: (value: number) => void;
      let resolve2!: (value: number) => void;

      sumProcess
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve1 = r;
          })
        )
        .attachToRoot();

      sumProcess
        .register(() =>
          SingleEvent.create<number>(r => {
            resolve2 = r;
          })
        )
        .attachToRoot();

      let resolved = false;
      let result: number | undefined;
      sumProcess
        .start(1)
        .tap(value => {
          resolved = true;
          result = value;
        })
        .attachToRoot();

      resolve1(10);
      resolve2(20);

      expect(resolved).toBeTruthy();
      expect(result).toBe(30);
    });
  });
});
