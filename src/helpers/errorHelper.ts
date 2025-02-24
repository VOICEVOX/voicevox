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
 * errorToMessageに渡すとユーザー向けのメッセージとして扱われる。
 */
export class DisplayableError extends Error {
  constructor(userFriendlyMessage: string, { cause }: { cause?: Error } = {}) {
    super(userFriendlyMessage, { cause });
    this.name = "DisplayableError";
  }
}

/**
 * 例外からエラーメッセージを作る。
 * DisplayableErrorのメッセージはユーザー向けのメッセージとして扱う。
 * それ以外の例外のメッセージは内部エラーメッセージとして扱う。
 * causeやAggregateErrorの場合は再帰的に処理する。
 * 再帰的に処理する際、一度DisplayableError以外の例外を処理した後は内部エラーメッセージとして扱う。
 * 長い場合は後ろを切る。
 */
export const errorToMessage = (e: unknown): string => {
  const errors = flattenErrors(e);
  const messages = toMessageLines(errors);
  return trim(messages.join("\n"));

  function flattenErrors(e: unknown): unknown[] {
    if (e instanceof AggregateError) {
      return [e, ...e.errors.flatMap(flattenErrors)];
    }
    if (e instanceof Error) {
      return [e, ...(e.cause ? flattenErrors(e.cause) : [])];
    }
    return [e];
  }

  function toMessageLines(errors: unknown[]): string[] {
    const messageLines: string[] = [];

    let isInner = false;
    for (const e of errors) {
      if (e instanceof DisplayableError) {
        messageLines.push(e.message);
        continue;
      }

      if (!isInner) {
        messageLines.push("（内部エラーメッセージ）");
        isInner = true;
      }

      if (e instanceof Error) {
        messageLines.push(
          e.name !== "Error" ? `${e.name}: ${e.message}` : e.message,
        );
        continue;
      }

      if (typeof e === "string") {
        messageLines.push(`Unknown Error: ${e}`);
        continue;
      }

      if (typeof e === "object" && e != undefined) {
        messageLines.push(`Unknown Error: ${JSON.stringify(e)}`);
        continue;
      }

      messageLines.push(`Unknown Error: ${String(e)}`);
    }

    return messageLines;
  }

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
