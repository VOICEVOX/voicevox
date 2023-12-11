import {
  defineStore,
  Store,
  DefineStoreOptions,
  StateTree,
  StoreDefinition,
} from "pinia";
import { UnwrapRef, DeepReadonly } from "vue";

/**
 * Vuexのstateに相当するpiniaのstoreを定義する関数
 * Stateを直接変更できないようにdefineStateでStoreとは別にStateを定義する.
 */
export function defineState<Id extends string, S extends StateTree>(
  options: DefineStoreOptions<Id, S, Record<never, never>, Record<never, never>>
) {
  return new StateController(options.id, defineStore(options));
}

/**
 * Stateに対してController(mutation, action)を用いた操作を定義するための関数
 */
export class StateController<Id extends string, S extends StateTree> {
  public readonly id: string;
  protected readonly _useStore: StateStoreDefinition<Id, S>;
  constructor(id: Id, useStore: StateStoreDefinition<Id, S>) {
    this.id = id;
    this._useStore = useStore;
  }

  /**
   * getter, mutation, actionを定義するためのcontext (defGet, defMut, defAct) を管理するクラス
   * */
  public useControllerContext(...args: Parameters<typeof this._useStore>) {
    const store = this._useStore(...args);
    return {
      defGet: <Ret>(
        getterDef: GetterDefinition<Id, S, Ret>
      ): Getter<Id, S, Ret> => ({
        [GETTER_TAG]: getterDef,
        [STORE_TAG]: store,
      }),
      defMut: <Payloads extends unknown[]>(
        mutationDef: MutationDefinition<Id, S, Payloads>
      ): Mutation<Id, S, Payloads> => ({
        [MUTATION_TAG]: mutationDef,
      }),
      defAct: <Payloads extends unknown[], Ret>(
        actionDef: ActionDefinition<Id, S, Payloads, Ret>
      ): Action<Id, S, Payloads, Ret> => ({
        [ACTION_TAG]: actionDef,
        [STORE_TAG]: store,
      }),
      _store: store,
    };
  }

  // Return readonly store.
  public useState(...args: Parameters<typeof this._useStore>) {
    const store = this._useStore(...args);
    return store as StateStore<Id, DeepReadonly<S>>;
  }

  // Return writable store. DO NOT USE for general purpose.
  public useWritableState(...args: Parameters<typeof this._useStore>) {
    const store = this._useStore(...args);
    return store;
  }
}

// .vueや他モジュールからimportしたgetter, actionを呼び出すための補助関数
export function useController() {
  const dispatch = templateDispatchWithoutStore();
  const get = templateGetWithoutStore();
  return {
    dispatch,
    get,
  };
}

export function templateDispatchWithoutStore(): Dispatch {
  function dispatch<
    Id extends string,
    S extends StateTree,
    Payloads extends unknown[],
    Ret
  >(action: Action<Id, S, Payloads, Ret>, ...payloads: Payloads) {
    const state = action[STORE_TAG];
    const actionContext: ActionContext<Id, S> = {
      state: state as DeepReadonly<UnwrapRef<S>>,
      dispatch,
      commit: templateCommit<Id, S>(state),
      get: templateGet<Id, S>(state as DeepReadonly<UnwrapRef<S>>),
    };
    return action[ACTION_TAG](actionContext, ...payloads);
  }
  return dispatch;
}

export function templateGetWithoutStore() {
  function get<Id extends string, S extends StateTree, Ret>(
    getter: Getter<Id, S, Ret>
  ) {
    const state = getter[STORE_TAG] as DeepReadonly<UnwrapRef<S>>;
    const getterContext: GetterContext<Id, S> = {
      state,
      get: templateGet(state),
    };
    return getter[GETTER_TAG](getterContext);
  }
  return get;
}

export function templateCommit<Id extends string, S extends StateTree>(
  state: UnwrapRef<S>
): Commit<Id, S> {
  const mutationContext: MutationContext<Id, S> = {
    state,
    get: templateGet<Id, S>(state as DeepReadonly<UnwrapRef<S>>),
    commit,
  };
  function commit<Payloads extends unknown[]>(
    mutaiton: Mutation<Id, S, Payloads>,
    ...payloads: Payloads
  ) {
    return mutaiton[MUTATION_TAG](mutationContext, ...payloads);
  }
  return commit;
}

export function templateGet<Id extends string, S extends StateTree>(
  state: DeepReadonly<UnwrapRef<S>>
): Get<Id, S> {
  const getterContext: GetterContext<Id, S> = {
    state,
    get,
  };
  function get<Ret>(getter: Getter<Id, S, Ret>) {
    return getter[GETTER_TAG](getterContext);
  }
  return get;
}

// symbol for hiding
export const GETTER_TAG: unique symbol = Symbol();
export const MUTATION_TAG: unique symbol = Symbol();
export const ACTION_TAG: unique symbol = Symbol();
export const STORE_TAG: unique symbol = Symbol();

// Context functions
export type Get<Id extends string, S extends StateTree> = <Ret>(
  getter: Getter<Id, S, Ret>
) => Ret;
export type Commit<Id extends string, S extends StateTree> = <
  Payloads extends unknown[]
>(
  mutation: Mutation<Id, S, Payloads>,
  ...payloads: Payloads
) => void;
export type Dispatch = <
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
>(
  action: Action<Id, S, Payloads, Ret>,
  ...payloads: Payloads
) => Ret;

// Getter
export type GetterContext<Id extends string, S extends StateTree> = {
  state: DeepReadonly<UnwrapRef<S>>;
  get: Get<Id, S>;
};
export type GetterDefinition<Id extends string, S extends StateTree, Ret> = (
  context: GetterContext<Id, S>
) => Ret;
export type Getter<Id extends string, S extends StateTree, Ret> = {
  [GETTER_TAG]: GetterDefinition<Id, S, Ret>;
  [STORE_TAG]: Store<Id, S>;
};

// Mutation
export type MutationContext<Id extends string, S extends StateTree> = {
  state: UnwrapRef<S>;
  get: Get<Id, S>;
  commit: Commit<Id, S>;
};
export type MutationDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[]
> = (context: MutationContext<Id, S>, ...payloads: Payloads) => undefined;
export type Mutation<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[]
> = {
  [MUTATION_TAG]: MutationDefinition<Id, S, Payloads>;
};

// Action
export type ActionContext<Id extends string, S extends StateTree> = {
  state: DeepReadonly<UnwrapRef<S>>;
  get: Get<Id, S>;
  commit: Commit<Id, S>;
  dispatch: Dispatch;
};
export type ActionDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = (context: ActionContext<Id, S>, ...payloads: Payloads) => Ret;
export type Action<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = {
  [ACTION_TAG]: ActionDefinition<Id, S, Payloads, Ret>;
  [STORE_TAG]: Store<Id, S>;
};

// state only store or stateDefinition type
export type StateStoreDefinition<Id extends string, S extends StateTree> =
  StoreDefinition<Id, S, Record<never, never>, Record<never, never>>;
export type StateStore<Id extends string, S extends StateTree> = Store<
  Id,
  S,
  Record<never, never>,
  Record<never, never>
>;
