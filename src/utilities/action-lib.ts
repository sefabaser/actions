import { Comparator } from 'helpers-lib';

import { Attachable, IAttachment } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { ClassID } from '../attachable/helpers/class-id';
import { AsyncOperation } from '../common';
import { Notifier } from '../observables/_notifier/notifier';
import { Reducer } from '../observables/reducer/reducer';
import { Sequence } from '../stream/sequence/sequence';
import { SingleEvent } from '../stream/single-event/single-event';

type ExtractStreamType<T> = T extends Sequence<infer U>
  ? U
  : T extends SingleEvent<infer U>
    ? U
    : T extends Notifier<infer U>
      ? U
      : never;

export class ActionLib {
  static merge<S>(...streams: AsyncOperation<S>[]): Sequence<S> {
    return this._merge(streams, 2);
  }

  static any<S>(...streams: AsyncOperation<S>[]): SingleEvent<S> {
    return this._merge(streams, 1);
  }

  private static _merge<S>(streams: AsyncOperation<S>[], type: 1): SingleEvent<S>;
  private static _merge<S>(streams: AsyncOperation<S>[], type: 2): Sequence<S>;
  private static _merge<S>(streams: AsyncOperation<S>[], type: 1 | 2): SingleEvent<S> | Sequence<S> {
    let activeSequences = this._validateAndConvertToSet(streams);

    let subscriptionsParent = new Attachable().attachToRoot();
    let subscriptions: IAttachment[] = [];

    let creator = type === 1 ? SingleEvent.create : Sequence.create;
    let merge = creator<S>(resolve => {
      for (let i = 0; i < streams.length; i++) {
        let subscription = streams[i]
          .subscribe(response => {
            resolve(response);
            if (type === 1) {
              subscriptionsParent.destroy();
            }
          })
          .attach(subscriptionsParent);
        subscriptions.push(subscription);
      }
      return () => subscriptionsParent.destroy();
    });

    this._waitUntilAllSequencesDestroyed(activeSequences, () => merge._executor._final());
    return merge;
  }

  static combine<const S extends readonly AsyncOperation<any>[]>(
    streams: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>>>(
    streamsObject: S
  ): Sequence<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static combine<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(input: S): Sequence<any> {
    return this._combineStreams(input, 2);
  }

  static all<const S extends readonly AsyncOperation<any>[]>(
    streams: S
  ): SingleEvent<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static all<S extends Record<string, AsyncOperation<any>>>(
    streamsObject: S
  ): SingleEvent<{ [K in keyof S]: ExtractStreamType<S[K]> }>;
  static all<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(input: S): SingleEvent<any> {
    return this._combineStreams(input, 1);
  }

  private static _combineStreams<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(
    input: S,
    type: 1
  ): SingleEvent<any>;
  private static _combineStreams<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(
    input: S,
    type: 2
  ): Sequence<any>;
  private static _combineStreams<S extends Record<string, AsyncOperation<any>> | readonly AsyncOperation<any>[]>(
    input: S,
    type: 1 | 2
  ): SingleEvent<any> | Sequence<any> {
    let isArray = Comparator.isArray(input);
    let streams = Object.values(input);
    if (streams.length === 0) {
      return isArray ? SingleEvent.instant([]) : SingleEvent.instant({});
    }

    let activeStreams = this._validateAndConvertToSet(streams);

    let latestValues: any = isArray ? [] : {};
    let keys = Object.keys(input);
    let unresolvedKeys = new Set(keys);

    let subscriptionsParent = new Attachable().attachToRoot();
    let subscriptions: IAttachment[] = [];

    let creator = type === 1 ? SingleEvent.create : Sequence.create;
    let combination = creator(resolve => {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let stream = (input as any)[key];
        let subscription = stream
          .subscribe((data: unknown) => {
            latestValues[key] = data;
            if (unresolvedKeys.size === 0) {
              resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
              type === 1 && subscriptionsParent.destroy();
            } else {
              unresolvedKeys.delete(key);
              if (unresolvedKeys.size === 0) {
                resolve(isArray ? [...latestValues] : this._shallowCopy(latestValues));
                type === 1 && subscriptionsParent.destroy();
              }
            }
          })
          .attach(subscriptionsParent); // Each handled manually
        subscriptions.push(subscription);
      }

      return () => subscriptionsParent.destroy();
    });

    this._waitUntilAllSequencesDestroyed(activeStreams, () => combination._executor._final());
    return combination;
  }

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
        if (!(stream instanceof Notifier)) {
          stream._executor._attachIsCalled = true;
        }
      }

      throw new Error('Each given async operation to merge or combine has to be diferent.');
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
      let sequences = streams as Set<Sequence<unknown> | SingleEvent<unknown>>;

      let oneDestroyed = (sequence: Sequence<unknown> | SingleEvent<unknown>) => {
        sequences.delete(sequence);
        if (sequences.size === 0) {
          callback();
        }
      };

      for (let sequence of sequences) {
        if (sequence.destroyed) {
          oneDestroyed(sequence);
        } else {
          sequence._executor._onDestroyListener = () => oneDestroyed(sequence);
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

    return SingleEvent.create(resolve => {
      let subscription = allReducer
        .filter(value => value === false)
        ._subscribeSingle(() => resolve())
        .attachToRoot();
      return () => {
        subscription.destroy();
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
