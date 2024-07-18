export interface State<
  States extends State<States, Input, Context, Dispatcher>,
  Input,
  Context,
  Dispatcher,
> {
  process(payload: {
    input: Input;
    context: Context;
    dispatcher: Dispatcher;
    setNextState: (nextState: States) => void;
  }): void;
  onEnter(payload: { context: Context; dispatcher: Dispatcher }): void;
  onExit(payload: { context: Context; dispatcher: Dispatcher }): void;
}

export class StateMachine<
  States extends State<States, Input, Context, Dispatcher>,
  Input,
  Context,
  Dispatcher,
> {
  private readonly context: Context;
  private readonly dispatcher: Dispatcher;
  private readonly setNextState: (nextState: States) => void;

  private currentState: States;
  private nextState: States | undefined;

  constructor(initialState: States, context: Context, dispatcher: Dispatcher) {
    this.context = context;
    this.dispatcher = dispatcher;
    this.setNextState = (nextState: States) => {
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
