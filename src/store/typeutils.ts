type ConcatLiteral<T1 extends string, T2 extends string> = `${T1}${T2}`;
export const concatLiteral = <T1 extends string, T2 extends string>(
  t1: T1,
  t2: T2
): ConcatLiteral<T1, T2> => (t1 + t2) as ConcatLiteral<T1, T2>;

type MapAddPrefix<Prefix extends string, Arg extends Record<string, unknown>> =
  { [K in keyof Arg as ConcatLiteral<Prefix, K & string>]: Arg[K] };
export const mapAddPrefix =
  <Prefix extends string>(prefix: Prefix) =>
  <Arg extends Record<string, unknown>>(arg: Arg): MapAddPrefix<Prefix, Arg> =>
    Object.fromEntries(
      Object.entries(arg).map(([key, val]) => [prefix + key, val])
    ) as MapAddPrefix<Prefix, Arg>;

type RemovePrefix<Prefix extends string, K extends string> =
  K extends `${Prefix}${infer Rest}` ? Rest : K;
export const removePrefix =
  <Prefix extends string>(prefix: Prefix) =>
  <K extends string>(key: K): RemovePrefix<Prefix, K> =>
    (key.substring(0, prefix.length) == prefix
      ? key.substring(prefix.length)
      : key) as RemovePrefix<Prefix, K>;

type MapRemovePrefix<
  Prefix extends string,
  Arg extends Record<string, unknown>
> = {
  [K in keyof Arg as RemovePrefix<Prefix, K & string>]: Arg[K];
};
export const mapRemovePrefix =
  <Prefix extends string>(prefix: Prefix) =>
  <Arg extends Record<string, unknown>>(
    arg: Arg
  ): MapRemovePrefix<Prefix, Arg> =>
    Object.fromEntries(
      Object.entries(arg).map(([key, val]) => [removePrefix(prefix)(key), val])
    ) as MapRemovePrefix<Prefix, Arg>;

type FilterPrefix<Prefix extends string, Arg extends Record<string, unknown>> =
  {
    [K in keyof Arg as K extends `${Prefix}${string}` ? K : never]: Arg[K];
  };
export const filterPrefix =
  <Prefix extends string>(prefix: Prefix) =>
  <Arg extends Record<string, unknown>>(arg: Arg): FilterPrefix<Prefix, Arg> =>
    Object.fromEntries(
      Object.entries(arg).filter(
        ([key, val]) => key.substring(0, prefix.length) == prefix
      )
    ) as FilterPrefix<Prefix, Arg>;

type FilterNoPrefix<
  Prefix extends string,
  Arg extends Record<string, unknown>
> = {
  [K in keyof Arg as K extends `${Prefix}${string}` ? never : K]: Arg[K];
};
export const filterNoPrefix =
  <Prefix extends string>(prefix: Prefix) =>
  <Arg extends Record<string, unknown>>(
    arg: Arg
  ): FilterNoPrefix<Prefix, Arg> =>
    Object.fromEntries(
      Object.entries(arg).filter(
        ([key, val]) => key.substring(0, prefix.length) != prefix
      )
    ) as FilterNoPrefix<Prefix, Arg>;
