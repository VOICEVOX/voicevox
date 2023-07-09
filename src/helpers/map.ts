export function mapUndefinedPipe<T, U1>(
  source: T | undefined,
  fn1: (_: NonNullable<T>) => U1 | undefined
): U1 | undefined;
export function mapUndefinedPipe<T, U1, U2>(
  source: T | undefined,
  fn1: (_: NonNullable<T>) => U1 | undefined,
  fn2: (_: NonNullable<U1>) => U2 | undefined
): U2 | undefined;
export function mapUndefinedPipe<T, U1, U2, U3>(
  source: T | undefined,
  fn1: (_: NonNullable<T>) => U1 | undefined,
  fn2: (_: NonNullable<U1>) => U2 | undefined,
  fn3: (_: NonNullable<U2>) => U3 | undefined
): U3 | undefined;
/**
 * 一連の関数を実行する。途中でundefinedを返すとその後undefinedを返す。
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function mapUndefinedPipe<T>(source: T[], ...fn: Function[]) {
  return fn.reduce((prev, curr) => {
    if (prev === undefined) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return curr(prev);
  }, source);
}

export const undefinedToDefault = <T>(
  defaultValue: T,
  maybeValue: T | undefined
): T => {
  if (maybeValue === undefined) {
    return defaultValue;
  }
  return maybeValue;
};
