/**
 * このファイルのコードは実装中で、現在使われていません。
 * issue: https://github.com/VOICEVOX/voicevox/issues/2041
 */

/**
 * ステートマシンのステートを表すインターフェース。
 *
 * @template State このインターフェースを実装するステートの型。
 * @template Input ステートが処理する入力の型。
 * @template Context ステート間で共有されるコンテキストの型。
 */
export interface IState<
  State extends IState<State, Input, Context>,
  Input,
  Context,
> {
  /**
   * 入力を処理し、必要に応じて次のステートを設定する。
   *
   * @param payload `input`、`context`、`setNextState`関数を含むペイロード。
   */
  process(payload: {
    input: Input;
    context: Context;
    setNextState: (nextState: State) => void;
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
 * ステートマシンを表すクラス。
 *
 * @template State ステートマシンのステートの型。
 * @template Input ステートが処理する入力の型。
 * @template Context ステート間で共有されるコンテキストの型。
 */
export class StateMachine<
  State extends IState<State, Input, Context>,
  Input,
  Context,
> {
  private readonly context: Context;

  private currentState: State;

  /**
   * @param initialState ステートマシンの初期ステート。
   * @param context ステート間で共有されるコンテキスト。
   */
  constructor(initialState: State, context: Context) {
    this.context = context;
    this.currentState = initialState;

    this.currentState.onEnter(this.context);
  }

  /**
   * ステートマシンの現在のステートを返す。
   *
   * @returns 現在のステート。
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * 現在のステートを使用して入力を処理し、必要に応じてステートの遷移を行う。
   *
   * @param input 処理する入力。
   */
  process(input: Input) {
    let nextState: State | undefined = undefined;
    const setNextState = (arg: State) => {
      nextState = arg;
    };
    this.currentState.process({
      input,
      context: this.context,
      setNextState,
    });
    if (nextState != undefined) {
      this.currentState.onExit(this.context);
      this.currentState = nextState;
      this.currentState.onEnter(this.context);
    }
  }
}
