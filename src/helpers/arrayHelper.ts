export const flatWithSeparator = <T>(arr: T[][], separator: T): T[] => {
  const result: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(...arr[i]);
    if (i < arr.length - 1) {
      result.push(separator);
    }
  }
  return result;
};

export const removeNullableAndBoolean = <T>(
  arr: (T | null | undefined | false | true)[],
): T[] => arr.filter((x): x is T => x != null && x !== false && x !== true);
