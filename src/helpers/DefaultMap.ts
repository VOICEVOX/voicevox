export default class DefaultMap<K, V> extends Map<K, V> {
  constructor(private readonly factory: (key: K) => V) {
    super();
  }

  get(key: K): V {
    const maybeValue = super.get(key);
    if (maybeValue) {
      return maybeValue;
    }
    const value = this.factory(key);
    this.set(key, value);
    return value;
  }
}
