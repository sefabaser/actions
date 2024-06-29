import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';
import { ActionLibDefaults } from '../../config';

export interface ReducerOptions {
  clone?: boolean;
}

export type ReducerReduceFunction<EffectType, ResponseType> = (change: {
  id: number;
  current?: EffectType;
  previous?: EffectType;
  type: 'initial' | 'effect' | 'update' | 'destroy';
}) => ResponseType;

export class ReducerEffectChannel<EffectType, ResponseType> {
  private static nextAvailableId = 1;

  private id: number;
  private reducer: Reducer<EffectType, ResponseType>;
  private previousEffectValue: EffectType;
  private destroyed = false;

  constructor(reducer: Reducer<EffectType, ResponseType>, value: EffectType) {
    this.id = ReducerEffectChannel.nextAvailableId++;
    this.reducer = reducer;

    let reducerResponse = this.reducer['reduceFunction']({
      id: this.id,
      current: value,
      type: 'effect'
    });

    this.previousEffectValue = value;
    this.reducer['broadcast'](reducerResponse);
  }

  update(value: EffectType): void {
    if (!this.destroyed) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.previousEffectValue,
        current: value,
        type: 'update'
      });

      this.previousEffectValue = value;
      this.reducer['broadcast'](reducerResponse);
    } else {
      throw new Error(`ReducerEffectChannel: This effect is destroyed cannot be updated!`);
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.previousEffectValue,
        type: 'destroy'
      });

      this.reducer['broadcast'](reducerResponse);

      this.reducer['effects'].delete(this);
      this.destroyed = true;
    }
  }
}

export class Reducer<EffectType, ResponseType> {
  static createExistenceChecker(): Reducer<void, boolean> {
    let set = new Set<number>();

    return new Reducer(change => {
      if (change.type === 'effect' || change.type === 'update') {
        set.add(change.id);
      } else if (change.type === 'destroy') {
        set.delete(change.id);
      }
      return set.size > 0;
    });
  }

  static createOr(): Reducer<boolean, boolean> {
    let set = new Set<number>();

    return new Reducer(change => {
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
    });
  }

  static createAnd(): Reducer<boolean, boolean> {
    let set = new Set<number>();

    return new Reducer(change => {
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
    });
  }

  static createSum(): Reducer<number, number> {
    let sum = 0;
    return new Reducer<number, number>(change => {
      if ((change.type === 'destroy' || change.type === 'update') && change.previous) {
        sum -= change.previous;
      }

      if ((change.type === 'effect' || change.type === 'update') && change.current) {
        sum += change.current;
      }

      return sum;
    });
  }

  static createCollector<EffectType>(options: ReducerOptions = {}): Reducer<EffectType, EffectType[]> {
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

    return new Reducer<{ key: string; value: any }, ResultType>(
      change => {
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
      },
      { clone: options && options.clone }
    );
  }

  get value(): ResponseType {
    return this.previousBroadcast;
  }

  get effectCount(): number {
    return this.effects.size;
  }

  private notificationHandler = new NotificationHandler<ResponseType>();
  private untilListeners = new Set<{ expected: ResponseType; callback: (data: ResponseType) => void }>();
  private effects: Set<ReducerEffectChannel<EffectType, ResponseType>> = new Set();
  private reduceFunction: ReducerReduceFunction<EffectType, ResponseType>;

  private previousBroadcast: ResponseType;
  private clone = false;

  constructor(reduceFunction: ReducerReduceFunction<EffectType, ResponseType>, options: ReducerOptions = {}) {
    this.reduceFunction = reduceFunction;
    this.clone = options.clone !== undefined ? options.clone : ActionLibDefaults.reducer.cloneBeforeNotification;

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

  subscribe(callback: (response: ResponseType) => void): ActionSubscription {
    try {
      callback(this.previousBroadcast);
    } catch (e) {
      console.error('Reducer callback function error: ', e);
    }
    return this.notificationHandler.subscribe(callback);
  }

  waitUntilCallback(data: ResponseType, callback: (data: ResponseType) => void): void {
    if (Comparator.isEqual(this.previousBroadcast, data)) {
      callback(data);
    } else {
      this.untilListeners.add({ expected: data, callback });
    }
  }

  async waitUntil(data: ResponseType): Promise<ResponseType> {
    return new Promise(resolve => {
      this.waitUntilCallback(data, resolve);
    });
  }

  private broadcast(value: ResponseType): void {
    if (!Comparator.isEqual(this.previousBroadcast, value)) {
      if (this.clone && Comparator.isObject(value)) {
        value = JsonHelper.deepCopy(value);
      }

      this.notificationHandler.forEach(callback => {
        try {
          callback(value);
        } catch (e) {
          console.error('Reducer callback function error: ', e);
        }
      });

      this.untilListeners.forEach(item => {
        if (Comparator.isEqual(item.expected, value)) {
          item.callback(value);
          this.untilListeners.delete(item);
        }
      });

      this.previousBroadcast = value;
    }
  }
}
