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

/** エラーからエラー文を作る */
export const errorToMessage = (e: unknown): string => {
  if (e instanceof Error) {
    return `${e.toString()}: ${e.message}`;
  } else if (typeof e === "string") {
    return `String Error: ${e}`;
  } else if (typeof e === "object" && e != undefined) {
    return `Object Error: ${JSON.stringify(e).slice(0, 100)}`;
  } else {
    return `Unknown Error: ${String(e)}`;
  }
};
