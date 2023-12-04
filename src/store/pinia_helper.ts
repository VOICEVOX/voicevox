import {
  defineStore,
  StoreDefinition,
  Store,
  StateTree,
  DefineStoreOptions,
} from "pinia";
import { computed, ComputedRef, UnwrapRef, DeepReadonly } from "vue";

/**
 * Stateを直接変更できないようにdefineStateでStoreとは別にStateを定義する.
 */
export const defineState = <Id extends string, S extends StateTree>(
  option: DefineStoreOptions<Id, S, Record<never, never>, Record<never, never>>
) => {
  const useStore = defineStore(option);
  return new StateController(option.id, useStore);
};

export class StateController<Id extends string, S extends StateTree> {
  public readonly id: string;
  protected readonly _useStore: StateStoreDefinition<Id, S>;
  constructor(id: Id, useStore: StateStoreDefinition<Id, S>) {
    this.id = id;
    this._useStore = useStore;
  }

  public useState(...params: Parameters<StateStoreDefinition<Id, S>>) {
    return this._useStore(...params) as StateStore<Id, DeepReadonly<S>>;
  }

  public useWritableState(...params: Parameters<StateStoreDefinition<Id, S>>) {
    return this._useStore(...params);
  }

  // Getterを定義するための型ヘルパー
  public defGetRaw<Ret>(getter: GetterDefinition<S, Ret>) {
    return getter;
  }

  // Mutationを定義するための型ヘルパー
  public defMutRaw<Payloads extends unknown[]>(
    mutation: MutationDefinition<S, Payloads>
  ) {
    return mutation;
  }

  public useContext() {
    // 一般に公開するreadonlyなstate
    const state = this.useState();
    // 書き込み可能なstate
    const _writableState = state as Store<Id, Writable<S>>;

    // getterに必要なstateの依存を解決する関数
    const get = <Ret>(getter: GetterDefinition<S, Ret>): Ret => {
      return getter(state);
    };
    // getterを定義するための関数
    // 元関数を.funcプロパティに定義
    // .getプロパティにstateを渡した関数を定義する
    const defGet = <Ret>(
      getterDef: GetterDefinition<S, Ret>
    ): Getter<S, Ret> => {
      const getter: Getter<S, Ret> = {
        func: getterDef,
        get: () => getterDef(state),
        ref: computed(() => getterDef(state)),
      };
      return getter;
    };
    const getRef = <Ret>(
      getter: GetterDefinition<S, Ret>
    ): ComputedRef<Ret> => {
      return computed(() => getter(state));
    };

    // eslint-disable-next-line @typescript-eslint/ban-types
    const defAct = <A extends Function>(action: A): Action<A> => {
      return {
        dispatch: action,
      };
    };
    const asAct =
      <Payloads extends unknown[]>(mutation: MutationDefinition<S, Payloads>) =>
      (...payloads: Payloads) =>
        mutation(_writableState, ...payloads);
    const defMut = <Payloads extends unknown[]>(
      mutationDef: MutationDefinition<S, Payloads>
    ) => {
      const mutaiton: Mutation<S, Payloads> = {
        func: mutationDef,
        commit: asAct(mutationDef),
      };
      return mutaiton;
    };

    return {
      state,
      _writableState,
      defGet,
      defMut,
      defAct,
      get,
      getRef,
      asAct,
    };
  }
}

export type Mark<S extends symbol> = Record<S, S>;
export type Marked<S extends symbol, O> = Mark<S> & O;

/**
 * 書き込み可能なstateに付与されるBrandプロパティ
 */
const WRITABLE: unique symbol = Symbol("WRITABLE");
export type Writable<S> = Marked<typeof WRITABLE, S>;

export type StateStoreDefinition<Id extends string, S extends StateTree> =
  StoreDefinition<Id, S, Record<never, never>, Record<never, never>>;
export type StateStore<Id extends string, S extends StateTree> = Store<
  Id,
  S,
  Record<never, never>,
  Record<never, never>
>;
export type GetterDefinition<S extends StateTree, Ret> = (
  state: UnwrapRef<DeepReadonly<S>>
) => Ret;
export type Getter<S extends StateTree, Ret> = {
  func: GetterDefinition<S, Ret>;
  get: () => Ret;
  ref: ComputedRef<Ret>;
};
export type MutationDefinition<
  S extends StateTree,
  Payloads extends unknown[]
> = (draft: Writable<UnwrapRef<S>>, ...payloads: Payloads) => void;
export type Mutation<S extends StateTree, Payloads extends unknown[]> = {
  func: MutationDefinition<S, Payloads>;
  commit: (...payloads: Payloads) => void;
};
// eslint-disable-next-line @typescript-eslint/ban-types
export type Action<A extends Function> = {
  dispatch: A;
};
