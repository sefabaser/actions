import { Comparator } from 'helpers-lib';

import { Attachable, IAttachment } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { ClassID } from '../attachable/helpers/class-id';
import { AsyncOperation } from '../common';
import { Notifier } from '../observables/_notifier/notifier';
import { Reducer } from '../observables/reducer/reducer';
import { Sequence } from '../stream/sequence/sequence';
import { SingleEvent } from '../stream/single-event/single-event';

// TODO: Include SingleEvent and write tests
type ExtractStreamType<T> = T extends Sequence<infer U> ? U : T extends Notifier<infer U> ? U : never;

export class ActionLib {
  static merge<S>(...streams: AsyncOperation<S>[]): Sequence<S> {
    let activeSequences = this._validateAndConvertToSet(streams);

    let subscriptions: IAttachment[] = [];
    let mergedSequence = Sequence.create<S>(resolve => {
      for (let i = 0; i < streams.length; i++) {
        let subscription = streams[i].subscribe(resolve).attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      }
      return () => {
        for (let i = 0; i < streams.length; i++) {
          subscriptions[i].destroy();
        }
      };
    });

    this._waitUntilAllSequencesDestroyed(activeSequences, () => mergedSequence._executor._final());
    return mergedSequence;
  }

  static combine<const S extends readonly AsyncOperation<any>[]>(
    streams: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>>>(
    streamsObject: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(input: S): Sequence<any> {
    let isArray = Comparator.isArray(input);
    let streams = Object.values(input);
    let activeStreams = this._validateAndConvertToSet(streams);

    let latestValues: any = isArray ? [] : {};
    let keys = Object.keys(input);
    let unresolvedKeys = new Set(keys);

    let subscriptions: IAttachment[] = [];
    let combinedSequence = Sequence.create<{ [K in keyof S]: S[K] extends Sequence<infer U> ? U : never }>(resolve => {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let stream = (input as any)[key];
        let subscription = stream
          .subscribe((data: unknown) => {
            latestValues[key] = data;
            if (unresolvedKeys.size === 0) {
              resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
            } else {
              unresolvedKeys.delete(key);
              if (unresolvedKeys.size === 0) {
                resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
              }
            }
          })
          .attachToRoot(); // Each handled manually
        subscriptions.push(subscription);
      }

      return () => {
        for (let i = 0; i < streams.length; i++) {
          subscriptions[i].destroy();
        }
      };
    });

    this._waitUntilAllSequencesDestroyed(activeStreams, () => combinedSequence._executor._final());
    return combinedSequence;
  }

  // TODO: singleCombine

  private static _shallowCopy<S extends object>(obj: S): S {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = (obj as any)[key];
      return acc;
    }, {} as any);
  }

  private static _validateAndConvertToSet(streams: AsyncOperation<unknown>[]) {
    let streamsSet = new Set(streams);
    if (streamsSet.size !== streams.length) {
      for (let i = 0; i < streams.length; i++) {
        let stream = streams[i];
        if (stream instanceof Sequence) {
          stream._executor._attachIsCalled = true;
        }
      }

      throw new Error('Each given sequence to merge or combine has to be diferent.');
    }
    return streamsSet;
  }

  private static _waitUntilAllSequencesDestroyed(streams: Set<AsyncOperation<unknown>>, callback: () => void): void {
    let notifierFound: boolean | undefined;
    for (let stream of streams) {
      if (stream instanceof Notifier) {
        notifierFound = true;
      }
    }

    if (!notifierFound) {
      let sequences = streams as Set<Sequence<unknown>>;

      let oneDestroyed = (sequence: Sequence<unknown>) => {
        sequences.delete(sequence);
        if (sequences.size === 0) {
          callback();
        }
      };

      for (let sequence of sequences) {
        if (sequence.destroyed) {
          oneDestroyed(sequence);
        } else {
          sequence._executor._onDestroyListeners.add(() => oneDestroyed(sequence));
        }
      }
    }
  }

  /**
   * @param attachables Entities that will be waited until all of them to be destroyed
   * @param callback Called after all given entities are destroyed
   * @returns SingleEvent
   */
  static untilAllDestroyed(attachables: Attachable[]): SingleEvent {
    let allReducer = Reducer.createExistenceChecker();
    let allEffectChannels = attachables.map(attachable => allReducer.effect().attach(attachable));

    return SingleEvent.create((resolve, context) => {
      allReducer
        .filter(value => value === false)
        ._subscribeSingle(() => resolve())
        .attach(context.attachable);
      return () => {
        for (let i = 0; i < allEffectChannels.length; i++) {
          allEffectChannels[i].destroy();
        }
      };
    });
  }

  /**
   * Resets everything. Helps unit tests to run without effecting each other if called before each test.
   */
  static hardReset(): void {
    ClassID._hardReset();
    AttachmentTargetStore._hardReset();
  }
}
