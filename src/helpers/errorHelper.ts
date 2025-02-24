import { UnreachableError } from "@/type/utility";

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
  return toMessageLines(errors);

  function flattenErrors(e: unknown): unknown[] {
    if (e instanceof AggregateError) {
      return [e, ...e.errors.flatMap(flattenErrors)];
    }
    if (e instanceof Error) {
      return [e, ...(e.cause ? flattenErrors(e.cause) : [])];
    }
    return [e];
  }

  function toMessageLines(errors: unknown[]): {
    displayable: string[];
    internal: string[];
  } {
    let displayableCount = errors.findIndex(
      (e) => !(e instanceof DisplayableError),
    );
    if (displayableCount === -1) {
      displayableCount = errors.length;
    }

    const displayable: string[] = [];
    for (const e of errors.slice(0, displayableCount)) {
      if (!(e instanceof DisplayableError)) {
        throw new UnreachableError();
      }
      displayable.push(e.message);
    }

    const internal: string[] = [];
    for (const e of errors.slice(displayableCount)) {
      if (e instanceof Error) {
        let message = "";
        if (!["Error", "AggregateError", "DisplayableError"].includes(e.name)) {
          message += `${e.name}: `;
        }
        message += e.message;
        internal.push(message);
        continue;
      }

      if (typeof e === "string") {
        internal.push(`Unknown Error: ${e}`);
        continue;
      }

      if (typeof e === "object" && e != undefined) {
        internal.push(`Unknown Error: ${JSON.stringify(e)}`);
        continue;
      }

      internal.push(`Unknown Error: ${String(e)}`);
    }

    return { displayable, internal };
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
