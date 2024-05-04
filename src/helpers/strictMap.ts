// Mapの拡張。
//
// - Mapを継承したStrictMapはimmerにより通常のMapになってしまう。
// - implements Map<K, V>のカスタムクラスはstructuredCloneにより{ map: Map<K, V> }になってしまう。
// そのため、Mapを直接拡張する。

const addProperty = (key: string, value: (...args: never[]) => unknown) => {
  // @ts-expect-error 意図的にPrototype汚染をしている。
  Map.prototype[key] = value;
};

addProperty(
  "mustGet",
  function (this: Map<unknown, unknown>, key: unknown): unknown {
    if (!this.has(key)) {
      throw new Error(`Key not found: ${key}`);
    }
    return this.get(key);
  },
);

addProperty(
  "mustDelete",
  function (this: Map<unknown, unknown>, key: unknown): void {
    if (!this.has(key)) {
      throw new Error(`Key not found: ${key}`);
    }
    this.delete(key);
  },
);

declare global {
  interface Map<K, V> {
    mustGet(key: K): V;
    mustDelete(key: K): void;
  }
}

export {};
