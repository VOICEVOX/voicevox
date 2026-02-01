---
root: false
targets: ["*"] 
description: "エラーハンドリングに関するユーティリティを使うためのガイドライン"
globs: ["**/*"]
---

# エラーハンドリングに関するユーティリティ

Voicevox 内ではいくつかのエラーハンドリングに関するユーティリティが提供されています。

## UnreachableError

到達しないであろうコードに到達したことを示すエラー。
到達しないコードに到達した場合のエラーは `UnreachableError` を投げるようにしてください。

```ts
// Bad
if (["a", "b", "c"].includes(value)) {
    if (value === "a") {
        // ...
    } else if (value === "b") {
        // ...
    } else if (value === "c") {
        // ...
    } else {
        throw new Error("到達しないはずのコードに到達しました");
    }
}

// Good
import { UnreachableError } from "@/type/utility";

if (["a", "b", "c"].includes(value)) {
    if (value === "a") {
        // ...
    } else if (value === "b") {
        // ...
    } else if (value === "c") {
        // ...
    } else {
        throw new UnreachableError();
    }
}
```

## ExhaustiveError

列挙型やユニオン型のすべてのケースを網羅していない場合に発生させるエラー。
網羅していない場合のエラーは `ExhaustiveError` を投げるようにしてください。

```ts
// Bad
type Fruit = "apple" | "banana" | "orange";
function getFruitColor(fruit: Fruit): string {
    if (fruit === "apple") {
        return "red";
    } else if (fruit === "banana") {
        return "yellow";
    } else if (fruit === "orange") {
        return "orange";
    } else {
        throw new Error("網羅されていないケースに到達しました");
    }
}

// Good
import { ExhaustiveError } from "@/type/utility";

type Fruit = "apple" | "banana" | "orange";
function getFruitColor(fruit: Fruit): string {
    if (fruit === "apple") {
        return "red";
    } else if (fruit === "banana") {
        return "yellow";
    } else if (fruit === "orange") {
        return "orange";
    } else {
        throw new ExhaustiveError(fruit);
    }
}
```

## ensureNotNullish

`null` または `undefined` でないことを保証する関数。
Non-Null Assertion Operatorの代わりに `ensureNotNullish` を使うようにしてください。

```ts
// Bad
function processValue(value: string | null | undefined) {
    const nonNullableValue = value!;
    // ...
}

// Good
import { ensureNotNullish } from "@/type/utility";

function processValue(value: string | null | undefined) {
    const nonNullableValue = ensureNotNullish(value);
    // ...
}
```

## assertNonNullable

`null` または `undefined` でないことをアサートする関数。
null・undefinedではないことを保証する場合は `assertNonNullable` を使うようにしてください。

```ts
// Bad
function processValue(value: string | null | undefined) {
    if (value === null || value === undefined) {
        throw new Error("value は null または undefined ではありません");
    }
    // ...
}

// Good
import { assertNonNullable } from "@/type/utility";

function processValue(value: string | null | undefined) {
    assertNonNullable(value);
    // ...
}
```
