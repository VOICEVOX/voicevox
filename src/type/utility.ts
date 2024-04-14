// XとYが同じ型かどうかを判定する
export type IsEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? true
  : false;

// undefinedかnullでないことを保証する
export function assertNonNullable<T>(
  value: T
): asserts value is NonNullable<T> {
  if (value == undefined) {
    throw new Error("Value is null or undefined");
  }
}
