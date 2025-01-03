/** 型付きのObject.entries */
export const objectEntries = <T extends Record<PropertyKey, unknown>>(
  obj: T,
): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};
