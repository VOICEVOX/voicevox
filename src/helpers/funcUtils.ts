type ObjectMap<
  A extends Record<string, unknown>,
  F extends (val: A[keyof A]) => unknown
> = { [K in keyof A]: ReturnType<F> };
export const objectMap = <
  A extends Record<string, unknown>,
  F extends (val: A[keyof A]) => unknown
>(
  arg: A,
  func: F
): ObjectMap<A, F> =>
  Object.fromEntries(
    Object.entries(arg).map(([key, value]) => [key, func(value as A[keyof A])])
  ) as ObjectMap<A, F>;

type GetterObject<A extends Record<string, unknown>> = {
  [K in keyof A]: () => A[K];
};
export const getterObject = <A extends Record<string, unknown>>(
  obj: A
): GetterObject<A> =>
  objectMap(obj, (val: A[keyof A]) => () => val) as GetterObject<A>;
