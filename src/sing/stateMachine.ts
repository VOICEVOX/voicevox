export abstract class State<
  States extends State<States, Input, Context, Dispatcher>,
  Input,
  Context,
  Dispatcher,
> {
  abstract process(
    input: Input,
    context: Context,
    dispatcher: Dispatcher,
    setNextState: (nextState: States) => void,
  ): void;

  onEnter(_context: Context, _dispatcher: Dispatcher) {}

  onExit(_context: Context, _dispatcher: Dispatcher) {}
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
      this.currentState.process(
        input,
        this.context,
        this.dispatcher,
        this.setNextState,
      );
      if (this.nextState != undefined) {
        this.currentState.onExit(this.context, this.dispatcher);
        this.currentState = this.nextState;
        this.currentState.onEnter(this.context, this.dispatcher);
      }
    } finally {
      this.nextState = undefined;
    }
  }
}
