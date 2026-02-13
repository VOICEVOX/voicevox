/** ブランド型を作る */
export type Brand<K, T> = K & { __brand: T };

/*
 * XとYが同じ型かどうかを判定する。
 * const _: IsEqual<X, Y> = true; のように使う。
 **/
export type IsEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// undefinedかnullでないことを保証する
export function assertNonNullable<T>(
  value: T,
  message = "Value is null or undefined",
): asserts value is NonNullable<T> {
  if (value == undefined) {
    throw new Error(message);
  }
}

/**
 * 入力がnullかundefinedの場合エラーを投げ、それ以外の場合は入力をそのまま返す
 *
 * NOTE: この関数は値を返すため、呼び出し側の変数自体の型は狭まりません。
 * 例えば:
 * ```ts
 * const m = someStr.match(/(...)/);
 * ensureNotNullish(m); // 戻り値を代入していないため、m の型は RegExpMatchArray | null のまま
 * // m[1] を直接参照すると型エラーになる可能性があります
 * ```
 *
 * 推奨パターン:
 * - 戻り値を再代入する: `const m2 = ensureNotNullish(m);`
 * - またはアサート関数を使って変数の型を絞る: `assertNonNullable(m);`
 */
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
 * never型になるはずの値を使って型システムで非到達をチェックできる便利クラス。
 * valueに指定した値がnever型じゃなかった場合に型システムがエラーを出してくれる。
 */
export class ExhaustiveError extends Error {
  constructor(value: never) {
    super(`Not exhaustive. value: ${String(value)}`);
  }
}

/**
 * 実行時に到達してはならない分岐を表すエラー。
 *
 * - switch の網羅性チェック崩壊
 * - 開発者が保証している不変条件違反
 *
 * nullable検査や入力バリデーション用途には
 * `assertNonNullable` や `ensureNotNullish` を使用する。
 */
// TODO: 到達不能分岐には UnreachableError を使用するよう統一する
export class UnreachableError extends Error {
  constructor(message?: string) {
    super(message || "Unreachable code was executed.");
    this.name = "UnreachableError";
  }
}
