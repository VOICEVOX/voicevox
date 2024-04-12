/** 複数のMapをマージする */
export function mergeMaps<T, U>(...maps: Map<T, U>[]): Map<T, U> {
  const result = new Map();
  for (const map of maps) {
    for (const [key, value] of map) {
      result.set(key, value);
    }
  }
  return result;
}
