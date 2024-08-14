/** Mapのヘルパー関数 */

/** Mapから値を取得する。指定したキーが存在しない場合は例外を投げる */
export const getOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${String(key)}`);
  }
  return map.get(key) as V;
};

/** Mapから値を削除する。指定したキーが存在しない場合は例外を投げる */
export const deleteOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${String(key)}`);
  }
  map.delete(key);
};
