/** 与えられた値がErrorならば、その値を返し、そうでなければ、その値をErrorにラップして返す */
export const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
