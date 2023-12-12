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
   * getter, mutation, actionを定義するためのcontextヘルパー (defGet, defMut, defAct) を得る関数
   **/
  public useControllerContext(...args: Parameters<typeof this._useStore>) {
    const store = this._useStore(...args);
    return {
      /**
       * `Getter`を定義する為の関数
       * @param getterDef - `getter`の定義関数
       * @example
       * const getter1 = defGet(({state}) => state.val1);
       * const getter2 = defGet(({state, get}) => get(getter1) && state.val2);
       */
      defGet: <Ret>(
        getterDef: GetterDefinition<Id, S, Ret>
      ): Getter<Id, S, Ret> => ({
        [GETTER_TAG]: getterDef,
        [STORE_TAG]: store,
      }),
      /**
       * `Mutation`を定義する為の関数
       * @param mutationDef - `mutation`の定義関数
       * @example
       * const mutation1 = defMut(({state}, arg1: string) => {
       *   state.val1 = arg1;
       * });
       * const mutation2 = defMut(({state, commit}, arg1: string, arg2: boolean) => {
       *   commit(mutation1, arg1);
       *   state.val2 = arg2;
       * });
       * const mutation3 = defMut(({state, get}) => {
       *   state.val2 = !get(getter2);
       * });
       */
      defMut: <Payloads extends unknown[]>(
        mutationDef: MutationDefinition<Id, S, Payloads>
      ): Mutation<Id, S, Payloads> => ({
        [MUTATION_TAG]: mutationDef,
      }),
      /**
       * `Action`を定義する為の関数
       * @param actionDef - `action`の定義関数
       * @example
       * const action1 = defAct(({commit}, arg1: string) => {
       *   commit(mutation1, arg1);
       * });
       * const action2 = defAct(({state, get, dispatch}, arg1: string) => {
       *   if (get(getter2))
       *     dispatch(action1, arg1);
       *   return state.val1;
       * });
       */
      defAct: <Payloads extends unknown[], Ret>(
        actionDef: ActionDefinition<Id, S, Payloads, Ret>
      ): Action<Id, S, Payloads, Ret> => ({
        [ACTION_TAG]: actionDef,
        [STORE_TAG]: store,
      }),
      _rawStore: store,
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

/**
 * .vueファイルや他モジュールでimportした`getter`, `action`を呼び出すための関数
 * @example
 * const store = useStore();
 * const { get, dispatch } = useController();
 * const ref1 = computed(() => get(store.getter1));
 * const onChange = (text: string) => dispatch(store.action1, text);
 */
export function useController() {
  const dispatch = templateDispatchWithoutStore();
  const get = templateGetWithoutStore();
  return {
    /**
     * `Action`を呼び出す為の関数
     * @example
     * const ret1 = dispatch(store.action1, text);
     */
    dispatch,
    /**
     * `Getter`を呼び出す為の関数
     * @example
     * const ref = computed(() => get(store.getter1));
     */
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

export function templateGetWithoutStore(): GlobalGet {
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
export type GlobalGet = <Id extends string, S extends StateTree, Ret>(
  getter: Getter<Id, S, Ret>
) => Ret;

// Getter
export type GetterContext<Id extends string, S extends StateTree> = {
  /**
   * 対象の`Store`が持っている`state` (readonly)
   */
  state: DeepReadonly<UnwrapRef<S>>;
  /**
   * 他のgetterを呼ぶための関数
   **/
  get: Get<Id, S>;
};
/**
 * Getterを実態を定義する為の関数
 */
export type GetterDefinition<Id extends string, S extends StateTree, Ret> = (
  /**
   * `state`, `getter`を参照する為のコンテキストが渡される引数
   */
  context: GetterContext<Id, S>
) => Ret;
/**
 * Getterの実態
 * `context`として渡される`get`関数を用いて呼び出すことができる。
 */
export type Getter<Id extends string, S extends StateTree, Ret> = {
  [GETTER_TAG]: GetterDefinition<Id, S, Ret>;
  [STORE_TAG]: Store<Id, S>;
};

// Mutation
export type MutationContext<Id extends string, S extends StateTree> = {
  /**
   * 対象の`Store`が持っている`state` (writable)
   */
  state: UnwrapRef<S>;
  /**
   * getterを呼ぶための関数
   **/
  get: Get<Id, S>;
  /**
   * 他のmutationを呼ぶための関数
   */
  commit: Commit<Id, S>;
};
export type MutationDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[]
> = (
  // `state`, `getter`, `mutation`を参照する為のコンテキストが渡される引数
  context: MutationContext<Id, S>,
  // Mutationが持つ引数
  ...payloads: Payloads
) => undefined;
/**
 * `Mutation`の実態
 * `context`として渡される`commit`関数を用いて呼び出すことができる。
 */
export type Mutation<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[]
> = {
  [MUTATION_TAG]: MutationDefinition<Id, S, Payloads>;
};

// Action
export type ActionContext<Id extends string, S extends StateTree> = {
  /**
   * 対象の`Store`が持っている`state` (readonly)
   */
  state: DeepReadonly<UnwrapRef<S>>;
  /**
   * getterを呼ぶための関数
   **/
  get: Get<Id, S>;
  /**
   * mutationを呼ぶための関数
   */
  commit: Commit<Id, S>;
  /**
   * 他のactionを呼ぶための関数
   */
  dispatch: Dispatch;
};
export type ActionDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = (
  // `state`, `getter`, `mutation`, `action`を参照する為のコンテキストが渡される引数
  context: ActionContext<Id, S>,
  // actionの引数
  ...payloads: Payloads
) => Ret;
/**
 * `Action`の実態
 * `context`として渡される`dispatch`関数を用いて呼び出すことができる。
 */
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
