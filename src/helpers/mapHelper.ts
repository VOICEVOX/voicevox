/** Mapのヘルパー関数 */

/** Mapから値を取得する。指定したキーが存在しない場合は例外を投げる */
export const getOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${key}`);
  }
  return map.get(key) as V;
};

/** 2重のMapから値を取得する。指定したキーが存在しない場合は例外を投げる */
export const getOrThrow2 = <K, K2, V>(
  map: Map<K, Map<K2, V>>,
  key: K,
  key2: K2,
) => {
  if (!map.has(key)) {
    throw new Error(`Key not found in outer map: ${key}`);
  }
  const innerMap = map.get(key) as Map<K2, V>;
  if (!innerMap.has(key2)) {
    throw new Error(`Key not found in inner map: ${key2}`);
  }
  return innerMap.get(key2) as V;
};

/** 2重のMapに値が存在するかどうかを返す */
export const has2 = <K, K2, V>(map: Map<K, Map<K2, V>>, key: K, key2: K2) => {
  if (!map.has(key)) {
    return false;
  }
  return (map.get(key) as Map<K2, V>).has(key2);
};

/** 2重のMapに値をセットする。1段目のMapが存在しない場合はエラーを投げる */
export const set2 = <K, K2, V>(
  map: Map<K, Map<K2, V>>,
  key: K,
  key2: K2,
  value: V,
) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${key}`);
  }
  (map.get(key) as Map<K2, V>).set(key2, value);
};

/** Mapから値を削除する。指定したキーが存在しない場合は例外を投げる */
export const deleteOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${key}`);
  }
  map.delete(key);
};
