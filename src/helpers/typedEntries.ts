/** 型付きのObject.entries */
export const objectEntries = <T extends Record<PropertyKey, unknown>>(
  obj: T,
): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};

/** 型付きのObject.fromEntries */
export const objectFromEntries = <
  const T extends ReadonlyArray<readonly [PropertyKey, unknown]>,
>(
  entries: T,
): { [K in T[number] as K[0]]: K[1] } => {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};

/** Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(key, value)])) と同等のことをする。 */
export const mapObjectValues = <T extends Record<PropertyKey, unknown>, R>(
  obj: T,
  fn: (key: keyof T, value: T[keyof T]) => R,
): Record<keyof T, R> => {
  return objectFromEntries(
    objectEntries(obj).map(([key, value]) => [key, fn(key, value)]),
  ) as unknown as Record<keyof T, R>;
};
