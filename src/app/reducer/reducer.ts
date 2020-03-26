import { Comparator, JsonHelper } from 'helpers-lib';

import { ActionSubscription, NotificationHandler } from '../../helpers/notification-handler';

export type ReducerReduceFunction<EffectType, ResponseType> = (change: {
  id: number;
  current?: EffectType;
  previous?: EffectType;
  type: 'initial' | 'effect' | 'update' | 'remove';
}) => ResponseType;

export class ReducerEffectChannel<EffectType, ResponseType> {
  private static nextAvailableId = 1;
  private id: number;
  private reducer: Reducer<EffectType, ResponseType>;
  private previousEffectValue: EffectType;
  private active = true;

  constructor(reducer: Reducer<EffectType, ResponseType>, value: EffectType) {
    this.id = ReducerEffectChannel.nextAvailableId++;
    this.reducer = reducer;

    let reducerResponse = this.reducer['reduceFunction']({
      id: this.id,
      current: value,
      type: 'effect'
    });

    this.previousEffectValue = value;
    this.broadcast(reducerResponse);
  }

  update(value: EffectType) {
    if (this.active) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.previousEffectValue,
        current: value,
        type: 'update'
      });

      this.previousEffectValue = value;
      this.broadcast(reducerResponse);
    }
  }

  remove() {
    if (this.active) {
      let reducerResponse = this.reducer['reduceFunction']({
        id: this.id,
        previous: this.previousEffectValue,
        type: 'remove'
      });

      this.broadcast(reducerResponse);
      this.active = false;
    }
  }

  private broadcast(value: ResponseType) {
    if (!Comparator.isEqual(this.reducer['previousBroadcast'], value)) {
      if (Comparator.isObject(value)) {
        value = JsonHelper.deepCopy(value);
      }

      this.reducer['notificationHandler'].forEach(callback => {
        try {
          callback(value);
        } catch (e) {
          console.error('Reducer callback function error: ', e);
        }
      });

      this.reducer['previousBroadcast'] = value;
    }
  }
}

export class Reducer<EffectType, ResponseType> {
  private notificationHandler = new NotificationHandler<ResponseType>();
  private reduceFunction: ReducerReduceFunction<EffectType, ResponseType>;

  private previousBroadcast: ResponseType;

  constructor(reduceFunction: ReducerReduceFunction<EffectType, ResponseType>) {
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

  static createExistenceChecker(): Reducer<void, boolean> {
    let set = new Set<number>();

    return new Reducer(change => {
      if (change.type === 'effect' || change.type === 'update') {
        set.add(change.id);
      } else if (change.type === 'remove') {
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
      } else if (change.type === 'remove') {
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
      } else if (change.type === 'remove') {
        set.delete(change.id);
      }
      return set.size === 0;
    });
  }

  static createSum(): Reducer<number, number> {
    let sum = 0;
    return new Reducer<number, number>(change => {
      if ((change.type === 'remove' || change.type === 'update') && change.previous) {
        sum -= change.previous;
      }

      if ((change.type === 'effect' || change.type === 'update') && change.current) {
        sum += change.current;
      }

      return sum;
    });
  }

  static createCollector<EffectType>(): Reducer<EffectType, EffectType[]> {
    let collection = new Map<number, EffectType>();
    return new Reducer<EffectType, EffectType[]>(change => {
      if (change.type === 'remove') {
        collection.delete(change.id);
      } else if (change.type === 'effect' || change.type === 'update') {
        change.current && collection.set(change.id, change.current);
      }

      let response: EffectType[] = [];
      collection.forEach(item => {
        response.push(item);
      });
      return response;
    });
  }

  static createObjectCreator<ResultType>(options?: {
    initial?: ResultType;
    doNotUpdateValueAtEffectCreation?: boolean;
  }): Reducer<{ key: string; value: any }, ResultType> {
    let collection: any = (options && options.initial) || {};
    let activeEffects = new Set<string>();

    return new Reducer<{ key: string; value: any }, ResultType>(change => {
      if (change.type === 'remove') {
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
    });
  }

  effect(value: EffectType): ReducerEffectChannel<EffectType, ResponseType> {
    return new ReducerEffectChannel<EffectType, ResponseType>(<any>this, value);
  }

  subscribe(callback: (response: ResponseType) => void): ActionSubscription {
    try {
      callback(this.previousBroadcast);
    } catch (e) {
      console.error('Reducer callback function error: ', e);
    }
    return this.notificationHandler.subscribe(callback);
  }
}
