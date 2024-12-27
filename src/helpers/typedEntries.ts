/** 型付きのObject.entries */
export const objectEntries = <
  T extends Record<string | number | symbol, unknown>,
>(
  obj: T,
): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};
