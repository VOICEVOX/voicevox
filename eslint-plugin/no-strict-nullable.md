# no-strict-nullable

厳密等価演算子`===`は有用ですが，`undefined`や`null`を右辺に持ってくる時，左辺が`undefined`を取りうるのか，それとも`null`を取りうるのかを考える必要があります．
一方，等価演算子`==`は`undefined`と`null`を区別しないため，このような場合に`==`を使うようにすることで，左辺が取る値を考える必要がなくなります．

このルールでは，右辺が`null`または`undefined`の場合に，厳密等価演算子`===`を使うことを禁止し，代わりに等価演算子`==`を使うようにします．

```ts
const a = fuga === undefined;
//        ^^^^^^^^^^^^^^^^^^ '=== null'ではなく'== null'を使用してください。
const button = { text: null };
const c = button.text !== null;
//        ^^^^^^^^^^^^^^^^^^^^ '!== null'ではなく'!= null'を使用してください。
```

## リンク

[#1513](https://github.com/VOICEVOX/voicevox/issues/1513)
