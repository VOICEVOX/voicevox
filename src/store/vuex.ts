import { InjectionKey } from "vue";
import {
  Store as BaseStore,
  createStore as baseCreateStore,
  useStore as baseUseStore,
  ModuleTree,
  Plugin,
  StoreOptions as OriginalStoreOptions,
  GetterTree as OriginalGetterTree,
  ActionTree as OriginalActionTree,
  MutationTree as OriginalMutationTree,
} from "vuex";
import type {
  AllActions,
  AllGetters,
  AllMutations,
  State,
  StoreType,
} from "./type";

export type PayloadFunction = (payload?: any) => any;

export type GettersBase = Record<string, any>;
export type ActionsBase = Record<string, PayloadFunction>;
export type MutationsBase = Record<string, any>;

export type PromiseType<T> = T extends Promise<infer P> ? P : T;

export class Store<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
> extends BaseStore<S> {
  constructor(options: OriginalStoreOptions<S>) {
    super(options);
  }

  readonly getters!: G;

  // 既に型がつけられているものを上書きすることになるので、TS2564を吐く、それの回避

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  dispatch: Dispatch<A>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  commit: Commit<M>;
}

export function createStore<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
>(options: StoreOptions<S, G, A, M>): Store<S, G, A, M> {
  // optionsをOriginalStoreOptions<S>で型キャストしないとTS2589を吐く
  return baseCreateStore<S>(options as OriginalStoreOptions<S>) as Store<
    S,
    G,
    A,
    M
  >;
}

export function useStore<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
>(injectKey?: InjectionKey<Store<S, G, A, M>> | string): Store<S, G, A, M> {
  return baseUseStore<S>(injectKey) as Store<S, G, A, M>;
}

export interface Dispatch<A extends ActionsBase> {
  <T extends keyof A>(type: T, ...payload: Parameters<A[T]>): Promise<
    PromiseType<ReturnType<A[T]>>
  >;
  <T extends keyof A>(
    payloadWithType: { type: T } & (Parameters<A[T]>[0] extends Record<
      string,
      any
    >
      ? Parameters<A[T]>[0]
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {})
  ): Promise<PromiseType<ReturnType<A[T]>>>;
}

export interface Commit<M extends MutationsBase> {
  <T extends keyof M>(
    type: T,
    ...payload: M[T] extends undefined ? void[] : [M[T]]
  ): void;
  <T extends keyof M>(
    payloadWithType: { type: T } & (M[T] extends Record<string, any>
      ? M[T]
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {})
  ): void;
}

export interface StoreOptions<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
  SG extends GettersBase = G,
  SA extends ActionsBase = A,
  SM extends MutationsBase = M
> {
  state?: S | (() => S);
  getters: GetterTree<S, S, G, SG>;
  actions: ActionTree<S, S, A, SG, SA, SM>;
  mutations: MutationTree<S, M>;
  modules?: ModuleTree<S>;
  plugins?: Plugin<S>[];
  strict?: boolean;
  devtools?: boolean;
}

export interface ActionContext<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase
> {
  dispatch: Dispatch<SA>;
  commit: Commit<SM>;
  state: S;
  getters: SG;
  rootState: R;
  rootGetters: any;
}

export type ActionHandler<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
  K extends keyof SA
> = (
  this: Store<S, SG, SA, SM>,
  injectee: ActionContext<S, R, SG, SA, SM>,
  payload: Parameters<SA[K]>[0]
) => ReturnType<SA[K]>;
export interface ActionObject<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
  K extends keyof SA
> {
  root?: boolean;
  handler: ActionHandler<S, R, SG, SA, SM, K>;
}

export type Getter<S, R, G, K extends keyof G, SG extends GettersBase> = (
  state: S,
  getters: SG,
  rootState: R,
  rootGetters: any
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
) => SG[K];

export type Action<
  S,
  R,
  A extends ActionsBase,
  K extends keyof A,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
> = ActionHandler<S, R, SG, SA, SM, K> | ActionObject<S, R, SG, SA, SM, K>;
export type Mutation<S, M extends MutationsBase, K extends keyof M> = (
  state: S,
  payload: M[K]
) => void;

export type GetterTree<S, R, G, SG = G> = G extends GettersBase
  ? CustomGetterTree<S, R, G, SG>
  : OriginalGetterTree<S, R>;

export type CustomGetterTree<
  S,
  R,
  G extends GettersBase,
  SG extends GettersBase
> = {
  [K in keyof G]: Getter<S, R, G, K, SG>;
};

export type ActionTree<S, R, A, SG, SA, SM> = A extends ActionsBase
  ? SA extends ActionsBase
    ? CustomActionTree<S, R, A, SG, SA, SM>
    : OriginalActionTree<S, R>
  : OriginalActionTree<S, R>;

export type CustomActionTree<
  S,
  R,
  A extends ActionsBase,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase
> = {
  [K in keyof A]: Action<S, R, A, K, SG, SA, SM>;
};

export type MutationTree<S, M> = M extends MutationsBase
  ? CustomMutationTree<S, M>
  : OriginalMutationTree<S>;

export type CustomMutationTree<S, M extends MutationsBase> = {
  [K in keyof M]: Mutation<S, M, K>;
};

type StoreTypesBase = {
  [key: string]: {
    getter?: GettersBase[number];
    mutation?: MutationsBase[number];
    action?: ActionsBase[number];
  };
};

type PartialStoreOptions<
  S,
  T extends StoreTypesBase,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
> = {
  [K in keyof T]: {
    [GAM in keyof T[K]]: GAM extends "getter"
      ? K extends keyof G
        ? Getter<S, S, G, K, AllGetters>
        : never
      : GAM extends "action"
      ? K extends keyof A
        ? Action<S, S, A, K, AllGetters, AllActions, AllMutations>
        : never
      : GAM extends "mutation"
      ? K extends keyof M
        ? Mutation<S, M, K>
        : never
      : never;
  };
};

export const createPartialStore = <
  T extends StoreTypesBase,
  G extends GettersBase = StoreType<T, "getter">,
  A extends ActionsBase = StoreType<T, "action">,
  M extends MutationsBase = StoreType<T, "mutation">
>(
  options: PartialStoreOptions<State, T, G, A, M>
): StoreOptions<State, G, A, M, AllGetters, AllActions, AllMutations> => {
  const obj = Object.keys(options).reduce(
    (acc, cur) => {
      const option = options[cur];

      if (option.getter) {
        acc.getters[cur] = option.getter;
      }
      if (option.mutation) {
        acc.mutations[cur] = option.mutation;
      }
      if (option.action) {
        acc.actions[cur] = option.action;
      }

      return acc;
    },
    {
      getters: Object.create(null),
      mutations: Object.create(null),
      actions: Object.create(null),
    }
  );

  return obj;
};
