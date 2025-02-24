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
  return trim(errorToMessageLines(e).join("\n"));

  function errorToMessageLines(
    e: unknown,
    { isInner }: { isInner?: boolean } = {},
  ): string[] {
    const messageLines: string[] = [];

    if (e instanceof DisplayableError) {
      messageLines.push(e.message);
      if (e.cause) {
        messageLines.push(...errorToMessageLines(e.cause, { isInner }));
      }
      return messageLines;
    }

    if (!isInner) {
      messageLines.push("（内部エラーメッセージ）");
      isInner = true;
    }

    if (e instanceof AggregateError) {
      if (e.message) {
        messageLines.push(e.message);
      }
      for (const error of e.errors) {
        messageLines.push(...errorToMessageLines(error, { isInner }));
      }
      return messageLines;
    }

    if (e instanceof Error) {
      messageLines.push(
        e.name !== "Error" ? `${e.name}: ${e.message}` : e.message,
      );
      if (e.cause) {
        messageLines.push(...errorToMessageLines(e.cause, { isInner }));
      }
      return messageLines;
    }

    if (typeof e === "string") {
      messageLines.push(`Unknown Error: ${e}`);
      return messageLines;
    }

    if (typeof e === "object" && e != undefined) {
      messageLines.push(`Unknown Error: ${JSON.stringify(e)}`);
      return messageLines;
    }

    messageLines.push(`Unknown Error: ${String(e)}`);
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
