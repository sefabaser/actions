import { Notifier } from './observables/_notifier/notifier';
import { Sequence } from './sequence/sequence';
import { SingleEvent } from './sequence/single-event';

export type AsyncOperation<T = void> = Notifier<T> | Sequence<T> | SingleEvent<T>;
