export interface IState<
  State extends IState<State, Input, Context>,
  Input,
  Context,
> {
  process(payload: {
    input: Input;
    context: Context;
    setNextState: (nextState: State) => void;
  }): void;
  onEnter(context: Context): void;
  onExit(context: Context): void;
}

export class StateMachine<
  State extends IState<State, Input, Context>,
  Input,
  Context,
> {
  private readonly context: Context;
  private readonly setNextState: (nextState: State) => void;

  private currentState: State;
  private nextState: State | undefined;

  constructor(initialState: State, context: Context) {
    this.context = context;
    this.setNextState = (nextState: State) => {
      this.nextState = nextState;
    };
    this.currentState = initialState;
    this.nextState = undefined;
  }

  getCurrentState() {
    return this.currentState;
  }

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
