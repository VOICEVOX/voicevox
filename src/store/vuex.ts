/* eslint-disable @typescript-eslint/no-explicit-any */
// FIXME: anyを使わないようにする
import { InjectionKey } from "vue";
import {
  Store as BaseStore,
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
  M extends MutationsBase,
> extends BaseStore<S> {
  constructor(options: StoreOptions<S, G, A, M>) {
    super(options as OriginalStoreOptions<S>);
    this.actions = dotNotationDispatchProxy(this.dispatch.bind(this));
    this.mutations = dotNotationCommitProxy(this.commit.bind(this));
  }

  declare readonly getters: G;

  // @ts-expect-error Storeの型を非互換な型で書き換えているためエラー
  declare dispatch: Dispatch<A>;
  // @ts-expect-error Storeの型を非互換な型で書き換えているためエラー
  declare commit: Commit<M>;
  /**
   * ドット記法用のActionを直接呼べる。エラーになる場合はdispatchを使う。
   * 詳細 https://github.com/VOICEVOX/voicevox/issues/2088
   */
  actions: DotNotationDispatch<A>;
  /**
   * ドット記法用のMutationを直接呼べる。エラーになる場合はcommitを使う。
   * 詳細 https://github.com/VOICEVOX/voicevox/issues/2088
   */
  mutations: DotNotationCommit<M>;
}

export function createStore<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
>(options: StoreOptions<S, G, A, M>): Store<S, G, A, M> {
  return new Store<S, G, A, M>(options);
}

export function useStore<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
>(injectKey?: InjectionKey<Store<S, G, A, M>> | string): Store<S, G, A, M> {
  // FIXME: dispatchとcommitの型を戻せばsuper typeになるのでunknownを消せる。
  return baseUseStore<S>(injectKey) as unknown as Store<S, G, A, M>;
}

export interface Dispatch<A extends ActionsBase> {
  <T extends keyof A>(
    type: T,
    ...payload: Parameters<A[T]>
  ): Promise<PromiseType<ReturnType<A[T]>>>;
  <T extends keyof A>(
    payloadWithType: { type: T } & (Parameters<A[T]>[0] extends Record<
      string,
      any
    >
      ? Parameters<A[T]>[0]
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {}),
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
        {}),
  ): void;
}

export type DotNotationDispatch<A extends ActionsBase> = {
  [T in keyof A]: (
    ...payload: Parameters<A[T]>
  ) => Promise<PromiseType<ReturnType<A[T]>>>;
};

const dotNotationDispatchProxy = <A extends ActionsBase>(
  dispatch: Dispatch<A>,
): DotNotationDispatch<A> =>
  new Proxy(
    { dispatch },
    {
      get(target, tag: string) {
        return (...payloads: Parameters<A[string]>) =>
          target.dispatch(tag, ...payloads);
      },
    },
  ) as DotNotationDispatch<A>;

export type DotNotationCommit<M extends MutationsBase> = {
  [T in keyof M]: (
    ...payload: M[T] extends undefined ? void[] : [M[T]]
  ) => void;
};

const dotNotationCommitProxy = <M extends MutationsBase>(
  commit: Commit<M>,
): DotNotationCommit<M> =>
  new Proxy(
    { commit },
    {
      get(target, tag: string) {
        return (...payloads: [M[string]]) => {
          target.commit(tag, ...payloads);
        };
      },
    },
  ) as DotNotationCommit<M>;

export interface StoreOptions<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
  SG extends GettersBase = G,
  SA extends ActionsBase = A,
  SM extends MutationsBase = M,
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
  SM extends MutationsBase,
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
  K extends keyof SA,
> = (
  this: Store<S, SG, SA, SM>,
  injectee: ActionContext<S, R, SG, SA, SM>,
  payload: Parameters<SA[K]>[0],
) => ReturnType<SA[K]>;
export interface ActionObject<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
  K extends keyof SA,
> {
  root?: boolean;
  handler: ActionHandler<S, R, SG, SA, SM, K>;
}

export type DotNotationActionContext<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
> = {
  /**
   * ドット記法用のActionを直接呼べる。エラーになる場合はdispatchを使う。
   * 詳細 https://github.com/VOICEVOX/voicevox/issues/2088
   */
  actions: DotNotationDispatch<SA>;
  /**
   * ドット記法用のMutationを直接呼べる。エラーになる場合はcommitを使う。
   * 詳細 https://github.com/VOICEVOX/voicevox/issues/2088
   */
  mutations: DotNotationCommit<SM>;
} & ActionContext<S, R, SG, SA, SM>;

export type DotNotationActionHandler<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
  K extends keyof SA,
> = (
  this: Store<S, SG, SA, SM>,
  injectee: DotNotationActionContext<S, R, SG, SA, SM>,
  payload: Parameters<SA[K]>[0],
) => ReturnType<SA[K]>;
export interface DotNotationActionObject<
  S,
  R,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
  K extends keyof SA,
> {
  root?: boolean;
  handler: DotNotationActionHandler<S, R, SG, SA, SM, K>;
}

export type Getter<S, R, G, K extends keyof G, SG extends GettersBase> = (
  state: S,
  getters: SG,
  rootState: R,
  rootGetters: any,
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
  SM extends MutationsBase,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
> = ActionHandler<S, R, SG, SA, SM, K> | ActionObject<S, R, SG, SA, SM, K>;
export type Mutation<S, M extends MutationsBase, K extends keyof M> = (
  state: S,
  payload: M[K],
) => void;

export type DotNotationAction<
  S,
  R,
  A extends ActionsBase,
  K extends keyof A,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
> =
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  | DotNotationActionHandler<S, R, SG, SA, SM, K>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  | DotNotationActionObject<S, R, SG, SA, SM, K>;

// ドット記法のActionを通常のActionに変換する関数
const unwrapDotNotationAction = <
  S,
  R,
  A extends ActionsBase,
  K extends keyof A,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
>(
  dotNotationAction: DotNotationAction<S, R, A, K, SG, SA, SM>,
): Action<S, R, A, K, SG, SA, SM> => {
  const wrappedHandler =
    typeof dotNotationAction === "function"
      ? dotNotationAction
      : dotNotationAction.handler;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const handler: ActionHandler<S, R, SG, SA, SM, K> = function (
    injectee,
    payload,
  ) {
    const dotNotationInjectee = {
      ...injectee,
      actions: dotNotationDispatchProxy(injectee.dispatch),
      mutations: dotNotationCommitProxy(injectee.commit),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return wrappedHandler.call(this, dotNotationInjectee, payload);
  };

  if (typeof dotNotationAction === "function") {
    return handler;
  } else {
    return {
      ...dotNotationAction,
      handler,
    };
  }
};

export type GetterTree<
  S,
  R,
  G extends GettersBase,
  SG extends GettersBase = G,
> = G extends GettersBase
  ? CustomGetterTree<S, R, G, SG>
  : OriginalGetterTree<S, R>;

export type CustomGetterTree<
  S,
  R,
  G extends GettersBase,
  SG extends GettersBase,
> = {
  [K in keyof G]: Getter<S, R, G, K, SG>;
};

export type ActionTree<
  S,
  R,
  A,
  SG extends GettersBase,
  SA extends ActionsBase,
  SM extends MutationsBase,
> = A extends ActionsBase
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
  SM extends MutationsBase,
> = {
  [K in keyof A]: Action<S, R, A, K, SG, SA, SM>;
};

export type MutationTree<S, M> = M extends MutationsBase
  ? CustomMutationTree<S, M>
  : OriginalMutationTree<S>;

export type CustomMutationTree<S, M extends MutationsBase> = {
  [K in keyof M]: Mutation<S, M, K>;
};

type StoreTypesBase = Record<
  string,
  {
    getter?: GettersBase[number];
    mutation?: MutationsBase[number];
    action?: ActionsBase[number];
  }
>;

type PartialStoreOptions<
  S,
  T extends StoreTypesBase,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
> = {
  [K in keyof T]: {
    [GAM in keyof T[K]]: GAM extends "getter"
      ? K extends keyof G
        ? Getter<S, S, G, K, AllGetters>
        : never
      : GAM extends "action"
        ? K extends keyof A
          ? DotNotationAction<S, S, A, K, AllGetters, AllActions, AllMutations>
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
  M extends MutationsBase = StoreType<T, "mutation">,
>(
  options: PartialStoreOptions<State, T, G, A, M>,
): StoreOptions<State, G, A, M, AllGetters, AllActions, AllMutations> => {
  const obj = Object.keys(options).reduce(
    (acc, cur) => {
      const option = options[cur];

      if (option.getter) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        acc.getters[cur] = option.getter;
      }
      if (option.mutation) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        acc.mutations[cur] = option.mutation;
      }
      if (option.action) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        acc.actions[cur] = unwrapDotNotationAction(option.action);
      }

      return acc;
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      getters: Object.create(null),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      mutations: Object.create(null),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      actions: Object.create(null),
    },
  );

  return obj;
};
