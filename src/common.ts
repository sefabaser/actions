import { NotifierBase } from './observables/_notifier/notifier-base';
import { Sequence } from './stream/sequence/sequence';
import { SingleEvent } from './stream/single-event/single-event';

export type AsyncOperation<T = void> = NotifierBase<T> | Sequence<T> | SingleEvent<T>;
