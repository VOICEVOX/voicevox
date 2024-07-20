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
  private readonly setNextState: (nextState: State) => void;

  private currentState: State;
  private nextState: State | undefined;

  /**
   * @param initialState ステートマシンの初期ステート。
   * @param context ステート間で共有されるコンテキスト。
   */
  constructor(initialState: State, context: Context) {
    this.context = context;
    this.setNextState = (nextState: State) => {
      this.nextState = nextState;
    };
    this.currentState = initialState;
    this.nextState = undefined;
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
    try {
      this.currentState.process({
        input,
        context: this.context,
        setNextState: this.setNextState,
      });
      if (this.nextState != undefined) {
        this.currentState.onExit(this.context);
        this.currentState = this.nextState;
        this.currentState.onEnter(this.context);
      }
    } finally {
      this.nextState = undefined;
    }
  }
}
