import { Notifier } from './observables/_notifier/notifier';
import { Sequence } from './stream/sequence/sequence';
import { SingleEvent } from './stream/single-event/single-event';

export type AsyncOperation<T = void> = Notifier<T> | Sequence<T> | SingleEvent<T>;
