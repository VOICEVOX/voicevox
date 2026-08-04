# non-unnecessary-non-null-assertion

`assertNonNullable`、`ensureNotNullish`を`T | null | undefined`以外の型に対して使用することを禁止します。

NOTE:
`assertNonNullable`、`ensureNotNullish`が`@/type/utility`からのものかどうかはチェックしていないため、他の場所で定義された同名の関数にも同様のチェックが適用されてしまう。
もし他の場所で定義された同名の関数が存在してそれを使用している場合は、このルールを無効化するか、ちゃんと`@/type/utility`からのものかどうかをチェックするルールを追加する必要がある。
