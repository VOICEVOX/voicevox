export const getOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${key}`);
  }
  return map.get(key) as V;
};

export const deleteOrThrow = <K, V>(map: Map<K, V>, key: K) => {
  if (!map.has(key)) {
    throw new Error(`Key not found: ${key}`);
  }
  map.delete(key);
};
