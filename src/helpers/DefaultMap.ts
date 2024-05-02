/** 存在しないキーにアクセスしたときに自動的に値を生成するMap */
export default class DefaultMap<K, V> extends Map<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    if (super.has(key)) {
      return super.get(key) as V;
    }
    const value = this.factory(key);
    this.set(key, value);
    return value;
  }
}
