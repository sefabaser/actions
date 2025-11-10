import { Notifier } from './observables/_notifier/notifier';
import { Sequence } from './sequence/sequence';
import { SingleEvent } from './sequence/single-event';

export type SyncOperation<T> = T extends Sequence<any>
  ? T extends Notifier<any>
    ? T extends SingleEvent<any>
      ? never
      : never
    : never
  : T;
export type AsyncOperation<T = void> = Notifier<T> | Sequence<T> | SingleEvent<T>;
