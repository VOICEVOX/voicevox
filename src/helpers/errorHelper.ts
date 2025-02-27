/** 入力がnullかundefinedの場合エラーを投げ、それ以外の場合は入力をそのまま返す */
export const ensureNotNullish = <T>(
  value: T | null | undefined,
  message = "Unexpected nullish value",
): T => {
  if (value == null) {
    throw new Error(message);
  }
  return value;
};

/**
 * ユーザーに表示するメッセージを持つエラー。
 * {@link errorToMessages}でユーザー向けのメッセージとして扱われる。
 */
export class DisplayableError extends Error {
  constructor(userFriendlyMessage: string, { cause }: { cause?: Error } = {}) {
    super(userFriendlyMessage, { cause });
    this.name = "DisplayableError";
  }
}

/**
 * 例外からユーザー向けのエラーメッセージと内部向けのエラーメッセージを作る。
 * DisplayableErrorのメッセージはユーザー向けとして扱う。
 * それ以外の例外のメッセージは内部向けとして扱う。
 * causeやAggregateErrorの場合は再帰的に処理する。
 * 再帰的に処理する際、一度DisplayableError以外の例外を処理した後は内部向けとして扱う。
 */
export const errorToMessages = (
  e: unknown,
): { displayable: string[]; internal: string[] } => {
  const errors = flattenErrors(e);
  const { displayable, internal } = splitErrors(errors);
  return {
    displayable: toMessages(displayable),
    internal: toMessages(internal),
  };

  function flattenErrors(e: unknown): unknown[] {
    const errors = [e];
    if (e instanceof AggregateError) {
      errors.push(...e.errors.flatMap(flattenErrors));
    }
    if (e instanceof Error && e.cause) {
      errors.push(...flattenErrors(e.cause));
    }
    return errors;
  }

  function splitErrors(errors: unknown[]): {
    displayable: unknown[];
    internal: unknown[];
  } {
    const firstInternalErrorIndex = errors.findIndex(
      (error) => !(error instanceof DisplayableError),
    );
    const splitIndex =
      firstInternalErrorIndex === -1 ? errors.length : firstInternalErrorIndex;

    return {
      displayable: errors.slice(0, splitIndex),
      internal: errors.slice(splitIndex),
    };
  }

  function toMessages(errors: unknown[]): string[] {
    const messages: string[] = [];
    for (const e of errors) {
      if (e instanceof Error) {
        let message = "";
        if (
          !(
            e.constructor === Error ||
            e instanceof AggregateError ||
            e instanceof DisplayableError
          )
        ) {
          message += `${e.name}: `;
        }
        message += e.message;
        messages.push(message);
        continue;
      }

      if (typeof e === "string") {
        messages.push(`Unknown Error: ${e}`);
        continue;
      }

      if (typeof e === "object" && e != undefined) {
        messages.push(`Unknown Error: ${JSON.stringify(e)}`);
        continue;
      }

      messages.push(`Unknown Error: ${String(e)}`);
    }
    return messages;
  }
};

/**
 * 例外からエラーメッセージを作る。
 * {@link errorToMessages}の結果を結合して返す。
 * 長い場合は後ろを切る。
 */
export const errorToMessage = (e: unknown): string => {
  const { displayable, internal } = errorToMessages(e);
  const messages = [...displayable];
  if (internal.length > 0) {
    messages.push("（内部エラーメッセージ）", ...internal);
  }
  return trim(messages.join("\n"));

  function trim(str: string) {
    return trimLongString(trimLines(str));
  }

  function trimLines(str: string) {
    // 15行以上ある場合は15行までにする
    const lines = str.split("\n");
    if (lines.length > 15) {
      return lines.slice(0, 15 - 1).join("\n") + "\n...";
    }
    return str;
  }

  function trimLongString(str: string) {
    // 300文字以上ある場合は300文字までにする
    if (str.length > 300) {
      return str.slice(0, 300 - 3) + "...";
    }
    return str;
  }
};
