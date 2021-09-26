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

export class Store<S, G, A, M> extends BaseStore<S> {
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

export function createStore<S, G, A, M>(
  options: StoreOptions<S, G, A, M>
): Store<S, G, A, M> {
  // optionsをOriginalStoreOptions<S>で型キャストしないとTS2589を吐く
  return baseCreateStore<S>(options as OriginalStoreOptions<S>) as Store<
    S,
    G,
    A,
    M
  >;
}

export function useStore<S, G, A, M>(
  injectKey?: InjectionKey<Store<S, G, A, M>> | string
): Store<S, G, A, M> {
  return baseUseStore<S>(injectKey) as Store<S, G, A, M>;
}

export interface Dispatch<A = any> {
  // TODO: payloadWithType方式の対応
  <T extends keyof A>(
    type: A extends Record<string, any> ? T : string,
    payload: A extends Record<string, any> ? Parameters<A[T]>[0] : any,
    options?: DispatchOptions
  ): Promise<ReturnType<A extends Record<string, any> ? A[T] : any>>;
}

export interface Commit<M = any> {
  // TODO: payloadWithType方式の対応
  <T extends keyof M>(
    type: M extends Record<string, any> ? T : string,
    payload: M extends Record<string, any> ? Parameters<M[T]>[0] : any,
    options?: CommitOptions
  ): void;
}

export interface StoreOptions<S, G, A, M> {
  state: S | (() => S);
  getters?: GetterTree<S, S, G>;
  actions?: ActionTree<S, S, A, M>;
  mutations?: MutationTree<S, M>;
  modules?: ModuleTree<S>;
  plugins?: Plugin<S>[];
  strict?: boolean;
  devtools?: boolean;
}

export type PayloadFunction = (payload?: any) => any;

export interface ActionContext<S, R, A, M> {
  dispatch: Dispatch<A>;
  commit: Commit<M>;
  state: S;
  getters: any;
  rootState: R;
  rootGetters: any;
}

export type ActionHandler<S, R, P extends PayloadFunction, A, M> = (
  this: Store<S, any, A, M>,
  injectee: ActionContext<S, R, A, M>,
  payload: Parameters<P>[0]
) => ReturnType<P>;
export interface ActionObject<S, R, P extends PayloadFunction, A, M> {
  root?: boolean;
  handler: ActionHandler<S, R, P, A, M>;
}

export type Getter<S, R, P extends PayloadFunction> = (
  state: S,
  getters: Parameters<P>[0],
  rootState: R,
  rootGetters: any
) => ReturnType<P>;
export type Action<S, R, P extends PayloadFunction, A, M> =
  | ActionHandler<S, R, P, A, M>
  | ActionObject<S, R, P, A, M>;
export type Mutation<S, P extends PayloadFunction> = (
  state: S,
  payload: Parameters<P>[0]
) => ReturnType<P>;

export type GetterTree<S, R, G> = G extends Record<string, PayloadFunction>
  ? GetterTree<S, R, G>
  : OriginalGetterTree<S, R>;

export type CustomGetterTree<S, R, G extends Record<string, PayloadFunction>> =
  {
    [K in keyof G]: Getter<S, R, G[K]>;
  };

export type ActionTree<S, R, A, M> = A extends Record<string, PayloadFunction>
  ? CustomActionTree<S, R, A, M>
  : OriginalActionTree<S, R>;

export type CustomActionTree<
  S,
  R,
  A extends Record<string, PayloadFunction>,
  M
> = {
  [K in keyof A]: Action<S, R, A[K], A, M>;
};

export type MutationTree<S, M> = M extends Record<string, PayloadFunction>
  ? CustomMutationTree<S, M>
  : OriginalMutationTree<S>;

export type CustomMutationTree<S, M extends Record<string, PayloadFunction>> = {
  [K in keyof M]: Mutation<S, M[K]>;
};
