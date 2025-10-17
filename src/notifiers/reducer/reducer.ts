import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionLibDefaults } from '../../config';
import { NotificationHelper } from '../../helpers/notification.helper';
import { LightweightAttachable } from '../../attachable/lightweight-attachable';
import { ActionSubscription } from '../notifier/action-subscription';
import { Notifier } from '../notifier/notifier';

export interface ReducerOptions {
  readonly clone: boolean;
}

export interface ReducerSubscriptionOptions {
  readonly listenOnlyNewChanges: boolean;
}

export type ReducerReduceFunction<EffectType, ResponseType> = (change: {
  readonly id: number;
  readonly current?: EffectType;
  readonly previous?: EffectType;
  readonly type: 'initial' | 'effect' | 'update' | 'destroy';
}) => ResponseType;

export class ReducerEffectChannel<EffectType, ResponseType> extends LightweightAttachable {
  private static nextAvailableId = 1;

  private id: number;
  private reducer: Reducer<EffectType, ResponseType>;

  private effectValue: EffectType;
  get value(): EffectType {
    return this.effectValue;
  }
  set value(value: EffectType) {
    this.update(value);
  }

  constructor(reducer: Reducer<EffectType, ResponseType>, value: EffectType) {
    super();

    this.id = ReducerEffectChannel.nextAvailableId++;
    this.reducer = reducer;

    let reducerResponse = this.reducer['reduceFunction']({
      id: this.id,
      current: value,
      type: 'effect'
    });

    this.effectValue = value;
    this.reducer['broadcast'](reducerResponse);
  }

  update(value: EffectType): void {
    if (!this.destroyed) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.effectValue,
        current: value,
        type: 'update'
      });

      this.effectValue = value;
      this.reducer['broadcast'](reducerResponse);
    } else {
      throw new Error(`ReducerEffectChannel: This effect is destroyed cannot be updated!`);
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.effectValue,
        type: 'destroy'
      });

      this.reducer['broadcast'](reducerResponse);

      this.reducer['effects'].delete(this);

      super.destroy();
    }
  }
}

export class Reducer<EffectType, ResponseType> extends Notifier<ResponseType> {
  static createExistenceChecker(): Reducer<void, boolean> {
    let set = new Set<number>();

    return new Reducer(
      change => {
        if (change.type === 'effect' || change.type === 'update') {
          set.add(change.id);
        } else if (change.type === 'destroy') {
          set.delete(change.id);
        }
        return set.size > 0;
      },
      { clone: false }
    );
  }

  static createOr(): Reducer<boolean, boolean> {
    let set = new Set<number>();

    return new Reducer(
      change => {
        if (change.type === 'effect' || change.type === 'update') {
          if (change.current) {
            set.add(change.id);
          } else {
            set.delete(change.id);
          }
        } else if (change.type === 'destroy') {
          set.delete(change.id);
        }
        return set.size > 0;
      },
      { clone: false }
    );
  }

  static createAnd(): Reducer<boolean, boolean> {
    let set = new Set<number>();

    return new Reducer(
      change => {
        if (change.type === 'effect' || change.type === 'update') {
          if (change.current) {
            set.delete(change.id);
          } else {
            set.add(change.id);
          }
        } else if (change.type === 'destroy') {
          set.delete(change.id);
        }
        return set.size === 0;
      },
      { clone: false }
    );
  }

  static createSum(): Reducer<number, number> {
    let sum = 0;
    return new Reducer<number, number>(
      change => {
        if ((change.type === 'destroy' || change.type === 'update') && change.previous) {
          sum -= change.previous;
        }

        if ((change.type === 'effect' || change.type === 'update') && change.current) {
          sum += change.current;
        }

        return sum;
      },
      { clone: false }
    );
  }

  static createCollector<EffectType>(options: Partial<ReducerOptions> = {}): Reducer<EffectType, EffectType[]> {
    let collection = new Map<number, EffectType>();
    return new Reducer<EffectType, EffectType[]>(change => {
      if (change.type === 'destroy') {
        collection.delete(change.id);
      } else if (change.type === 'effect' || change.type === 'update') {
        change.current && collection.set(change.id, change.current);
      }

      let response: EffectType[] = [];
      collection.forEach(item => {
        response.push(item);
      });
      return response;
    }, options);
  }

  static createObjectCreator<ResultType>(options?: {
    initial?: ResultType;
    doNotUpdateValueAtEffectCreation?: boolean;
    clone?: boolean;
  }): Reducer<{ key: string; value: any }, ResultType> {
    let collection: any = (options && options.initial) || {};
    let activeEffects = new Set<string>();

    return new Reducer<{ key: string; value: any }, ResultType>(change => {
      if (change.type === 'destroy') {
        if (change.previous) {
          delete collection[change.previous.key];
          activeEffects.delete(change.previous.key);
        }
      } else if (change.type === 'update') {
        if (change.current) {
          collection[change.current.key] = change.current.value;
        }
      } else if (change.type === 'effect') {
        if (change.current) {
          if (activeEffects.has(change.current.key)) {
            console.error(`There is another effect for '${change.current.key}' already exist!`);
          } else {
            activeEffects.add(change.current.key);
            if (!options || !options.doNotUpdateValueAtEffectCreation) {
              collection[change.current.key] = change.current.value;
            }
          }
        }
      }

      return <ResultType>collection;
    }, options);
  }

  get value(): ResponseType {
    return this.previousBroadcast;
  }

  get effectCount(): number {
    return this.effects.size;
  }

  private previousBroadcast: ResponseType;
  private options: ReducerOptions;

  private effects: Set<ReducerEffectChannel<EffectType, ResponseType>> = new Set();
  private reduceFunction: ReducerReduceFunction<EffectType, ResponseType>;

  constructor(reduceFunction: ReducerReduceFunction<EffectType, ResponseType>, partialOptions: Partial<ReducerOptions> = {}) {
    super();
    this.options = {
      clone: ActionLibDefaults.reducer.cloneBeforeNotification,
      ...partialOptions
    };

    this.reduceFunction = reduceFunction;

    let reducerResponse = this.reduceFunction({
      id: 0,
      type: 'initial'
    });

    if (Comparator.isObject(reducerResponse)) {
      reducerResponse = JsonHelper.deepCopy(reducerResponse);
    }
    this.previousBroadcast = reducerResponse;
  }

  effect(value: EffectType): ReducerEffectChannel<EffectType, ResponseType> {
    let effect = new ReducerEffectChannel<EffectType, ResponseType>(<any>this, value);
    this.effects.add(effect);
    return effect;
  }

  subscribe(callback: (response: ResponseType) => void, options?: ReducerSubscriptionOptions): ActionSubscription {
    if (!options?.listenOnlyNewChanges) {
      NotificationHelper.notify(this.previousBroadcast, callback);
    }
    return super.subscribe(callback);
  }

  waitUntil(data: ResponseType, callback: (data: ResponseType) => void): ActionSubscription {
    if (Comparator.isEqual(this.previousBroadcast, data)) {
      NotificationHelper.notify(data, callback);
      return ActionSubscription.destroyed;
    } else {
      return super.waitUntil(data, callback);
    }
  }

  private broadcast(value: ResponseType): void {
    if (!Comparator.isEqual(this.previousBroadcast, value)) {
      if (this.options.clone && Comparator.isObject(value)) {
        value = JsonHelper.deepCopy(value);
      }

      this.notificationHandler.forEach(callback => NotificationHelper.notify(value, callback));
      this.previousBroadcast = value;
    }
  }
}
