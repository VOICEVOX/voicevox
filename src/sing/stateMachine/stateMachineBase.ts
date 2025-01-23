/**
 * このファイルのコードは実装中で、現在使われていません。
 * issue: https://github.com/VOICEVOX/voicevox/issues/2041
 */

/**
 * 指定されたIDを持つ型を抽出するユーティリティ型。
 */
type ExtractById<T, U> = T extends { id: U } ? T : never;

/**
 * ステートの定義を表す型。
 */
type StateDefinition = {
  id: string;
  factoryArgs: Record<string, unknown> | undefined;
};

/**
 * ステートの定義のリストを表す型。
 */
export type StateDefinitions<T extends StateDefinition[]> = T;

/**
 * ステートのIDを表す型。
 */
type StateId<T extends StateDefinition[]> = T[number]["id"];

/**
 * ファクトリ関数の引数を表す型。
 */
type FactoryArgs<
  T extends StateDefinition[],
  U extends StateId<T>,
> = ExtractById<T[number], U>["factoryArgs"];

/**
 * 次のステートを設定する関数の型。
 */
export type SetNextState<T extends StateDefinition[]> = <U extends StateId<T>>(
  id: U,
  factoryArgs: FactoryArgs<T, U>,
) => void;

/**
 * ステートマシンのステートを表すインターフェース。
 *
 * @template State このインターフェースを実装するステートの型。
 * @template Input ステートが処理する入力の型。
 * @template Context ステート間で共有されるコンテキストの型。
 */
export interface State<
  StateDefinitions extends StateDefinition[],
  Input,
  Context,
> {
  readonly id: StateId<StateDefinitions>;

  /**
   * 入力を処理し、必要に応じて次のステートを設定する。
   *
   * @param payload `input`、`context`、`setNextState`関数を含むペイロード。
   */
  process(payload: {
    input: Input;
    context: Context;
    setNextState: SetNextState<StateDefinitions>;
  }): void;

  /**
   * ステートに入ったときに呼び出される。
   *
   * @param context ステート間で共有されるコンテキスト。
   */
  onEnter(context: Context): void;

  /**
   * ステートから出るときに呼び出される。
   *
   * @param context ステート間で共有されるコンテキスト。
   */
  onExit(context: Context): void;
}

/**
 * ステートのファクトリ関数を表す型。
 */
type StateFactories<
  T extends StateDefinition[],
  U extends StateId<T>,
  Input,
  Context,
> = {
  [P in U]: (
    args: FactoryArgs<T, P>,
  ) => State<T, Input, Context> & { readonly id: P };
};

/**
 * ステートマシンを表すクラス。
 *
 * @template State ステートマシンのステートの型。
 * @template Input ステートが処理する入力の型。
 * @template Context ステート間で共有されるコンテキストの型。
 */
export class StateMachine<
  StateDefinitions extends StateDefinition[],
  Input,
  Context,
> {
  private readonly stateFactories: StateFactories<
    StateDefinitions,
    StateId<StateDefinitions>,
    Input,
    Context
  >;
  private readonly context: Context;

  private currentState: State<StateDefinitions, Input, Context>;

  /**
   * ステートマシンの現在のステートのID。
   */
  get currentStateId() {
    return this.currentState.id;
  }

  /**
   * @param initialState ステートマシンの初期ステート。
   * @param context ステート間で共有されるコンテキスト。
   */
  constructor(
    stateFactories: StateFactories<
      StateDefinitions,
      StateId<StateDefinitions>,
      Input,
      Context
    >,
    initialState: State<StateDefinitions, Input, Context>,
    context: Context,
  ) {
    this.stateFactories = stateFactories;
    this.context = context;

    this.currentState = initialState;

    this.currentState.onEnter(this.context);
  }

  /**
   * 現在のステートを使用して入力を処理し、必要に応じてステートの遷移を行う。
   *
   * @param input 処理する入力。
   */
  process(input: Input) {
    let nextState: State<StateDefinitions, Input, Context> | undefined =
      undefined;
    this.currentState.process({
      input,
      context: this.context,
      setNextState: (id, factoryArgs) => {
        nextState = this.stateFactories[id](factoryArgs);
      },
    });
    if (nextState != undefined) {
      this.currentState.onExit(this.context);
      this.currentState = nextState;
      this.currentState.onEnter(this.context);
    }
  }
}
