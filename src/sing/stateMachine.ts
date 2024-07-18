export interface IState<
  State extends IState<State, Input, Context, Dispatcher>,
  Input,
  Context,
  Dispatcher,
> {
  process(payload: {
    input: Input;
    context: Context;
    dispatcher: Dispatcher;
    setNextState: (nextState: State) => void;
  }): void;
  onEnter(payload: { context: Context; dispatcher: Dispatcher }): void;
  onExit(payload: { context: Context; dispatcher: Dispatcher }): void;
}

export class StateMachine<
  State extends IState<State, Input, Context, Dispatcher>,
  Input,
  Context,
  Dispatcher,
> {
  private readonly context: Context;
  private readonly dispatcher: Dispatcher;
  private readonly setNextState: (nextState: State) => void;

  private currentState: State;
  private nextState: State | undefined;

  constructor(initialState: State, context: Context, dispatcher: Dispatcher) {
    this.context = context;
    this.dispatcher = dispatcher;
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
        dispatcher: this.dispatcher,
        setNextState: this.setNextState,
      });
      if (this.nextState != undefined) {
        this.currentState.onExit({
          context: this.context,
          dispatcher: this.dispatcher,
        });
        this.currentState = this.nextState;
        this.currentState.onEnter({
          context: this.context,
          dispatcher: this.dispatcher,
        });
      }
    } finally {
      this.nextState = undefined;
    }
  }
}
