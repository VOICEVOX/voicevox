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

/** エラーからエラー文を作る。長い場合は後ろを切る。 */
export const errorToMessage = (e: unknown): string => {
  if (e instanceof AggregateError) {
    const messageLines = [];
    if (e.message) {
      messageLines.push(e.message);
    }
    for (const error of e.errors) {
      messageLines.push(errorToMessage(error));
    }
    return trim(messageLines.join("\n"));
  }

  if (e instanceof Error) {
    let message = e.name !== "Error" ? `${e.name}: ${e.message}` : e.message;
    if (e.cause) {
      message += `\n${errorToMessage(e.cause)}`;
    }
    return trim(message);
  }

  if (typeof e === "string") {
    return trim(`Unknown Error: ${e}`);
  }

  if (typeof e === "object" && e != undefined) {
    return trim(`Unknown Error: ${JSON.stringify(e)}`);
  }

  return trim(`Unknown Error: ${String(e)}`);

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
