import { InjectionKey } from "vue";
import {
  Store as BaseStore,
  createStore as baseCreateStore,
  useStore as baseUseStore,
  DispatchOptions,
  CommitOptions,
  ModuleTree,
  Plugin,
  StoreOptions as OriginalStoreOptions,
  GetterTree as OriginalGetterTree,
  ActionTree as OriginalActionTree,
  MutationTree as OriginalMutationTree,
} from "vuex";

export type PayloadFunction = (payload?: Record<string, any>) => any;

export type GettersBase = Record<string, any>;
export type ActionsBase = Record<string, PayloadFunction>;
export type MutationsBase = Record<string, Record<string, any> | undefined>;

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
  <T extends keyof A>(
    type: T,
    payload: Parameters<A[T]>[0],
    options?: DispatchOptions
  ): Promise<ReturnType<A[T]>>;
  <T extends keyof A>(
    payloadWithType: { type: T } & (Parameters<A[T]>[0] extends undefined
      ? // eslint-disable-next-line @typescript-eslint/ban-types
        {}
      : Parameters<A[T]>[0]),
    options?: DispatchOptions
  ): Promise<ReturnType<A[T]>>;
}

export interface Commit<M extends MutationsBase> {
  <T extends keyof M>(type: T, payload: M[T], options?: CommitOptions): void;
  <T extends keyof M>(
    payloadWithType: { type: T } & (M[T] extends undefined
      ? // eslint-disable-next-line @typescript-eslint/ban-types
        {}
      : M[T]),
    options?: CommitOptions
  ): void;
}

export interface StoreOptions<
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
> {
  state: S | (() => S);
  getters?: GetterTree<S, S, G>;
  actions?: ActionTree<S, S, A, M>;
  mutations?: MutationTree<S, M>;
  modules?: ModuleTree<S>;
  plugins?: Plugin<S>[];
  strict?: boolean;
  devtools?: boolean;
}

export interface ActionContext<
  S,
  R,
  A extends ActionsBase,
  M extends MutationsBase
> {
  dispatch: Dispatch<A>;
  commit: Commit<M>;
  state: S;
  getters: any;
  rootState: R;
  rootGetters: any;
}

export type ActionHandler<
  S,
  R,
  A extends ActionsBase,
  M extends MutationsBase,
  K extends keyof A
> = (
  this: Store<S, any, A, M>,
  injectee: ActionContext<S, R, A, M>,
  payload: Parameters<A[K]>[0]
) => ReturnType<A[K]>;
export interface ActionObject<
  S,
  R,
  A extends ActionsBase,
  M extends MutationsBase,
  K extends keyof A
> {
  root?: boolean;
  handler: ActionHandler<S, R, A, M, K>;
}

export type Getter<S, R, G extends GettersBase, K extends keyof G> = (
  state: S,
  getters: G,
  rootState: R,
  rootGetters: any
) => G[K];
export type Action<
  S,
  R,
  A extends ActionsBase,
  M extends MutationsBase,
  K extends keyof A
> = ActionHandler<S, R, A, M, K> | ActionObject<S, R, A, M, K>;
export type Mutation<S, P> = (state: S, payload: P) => void;

export type GetterTree<S, R, G> = G extends GettersBase
  ? GetterTree<S, R, G>
  : OriginalGetterTree<S, R>;

export type CustomGetterTree<S, R, G extends GettersBase> = {
  [K in keyof G]: Getter<S, R, G, K>;
};

export type ActionTree<S, R, A, M extends MutationsBase> = A extends ActionsBase
  ? CustomActionTree<S, R, A, M>
  : OriginalActionTree<S, R>;

export type CustomActionTree<
  S,
  R,
  A extends ActionsBase,
  M extends MutationsBase
> = {
  [K in keyof A]: Action<S, R, A, M, K>;
};

export type MutationTree<S, M> = M extends Record<string, PayloadFunction>
  ? CustomMutationTree<S, M>
  : OriginalMutationTree<S>;

export type CustomMutationTree<S, M extends Record<string, PayloadFunction>> = {
  [K in keyof M]: Mutation<S, M[K]>;
};
