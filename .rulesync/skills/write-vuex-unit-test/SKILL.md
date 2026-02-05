---
name: write-vuex-unit-test
description: >-
  Vuex storeの単体テストを生成。mutation/action/getterのテスト作成時に使用。
---

# Vuex 単体テスト

## state の初期化

- 実 store を `cloneWithUnwrapProxy` で複製して初期状態を保存
- `beforeEach` で `store.replaceState` を使って毎回リセット
- `resetMockMode()` でランダム値を初期化

Good:

```typescript
import { beforeEach, expect, test } from "vitest";
import { store } from "@/store";
import { resetMockMode } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});
```

Bad 1 (mockを使う):

```typescript
const state: Partial<AudioStoreState> = {
  audioKeys: [],
  audioItems: {},
};
```

Bad 2 (beforeEach を使わない):

```typescript
const initialState = cloneWithUnwrapProxy(store.state);
// beforeEach が無いため、テスト間で状態が残る
```

## mutation のテスト

- `store.mutations.MUTATION_NAME(payload)` で mutation を呼び出す
- mutation は同期的に実行される

Good:

```typescript
test("INSERT_TRACK", () => {
  const trackId1 = TrackId(uuid4());
  store.mutations.INSERT_TRACK({
    trackId: trackId1,
    track: dummyTrack,
    prevTrackId: undefined,
  });
  expect(store.state.trackOrder.slice(1)).toEqual([trackId1]);
});
```

## action のテスト

- `await store.actions.ACTION_NAME(payload)` で action を呼び出す
- action は非同期なので `async/await` を使う

Good:

```typescript
test("コマンド実行で履歴が作られる", async () => {
  await store.actions.COMMAND_SET_AUDIO_KEYS({
    audioKeys: [AudioKey(uuid4())],
  });

  expect(store.state.audioKeys.length).toBe(1);
  expect(store.state.undoCommands.length).toBe(1);
  expect(store.state.redoCommands.length).toBe(0);
});
```

## getter のテスト

- `store.getters.GETTER_NAME` で getter を取得
- getter は実 store を通して呼び出す

Good:

```typescript
test("音声の合計時間を取得", () => {
  store.mutations.SET_AUDIO_KEYS([audioKey1, audioKey2]); // state を準備

  const total = store.getters.TOTAL_AUDIO_LENGTH;
  expect(total).toBeCloseTo(0.65);
});
```

Bad (getterを直接呼び出す):

```typescript
const total = (audioStore.getters as any).TOTAL_AUDIO_LENGTH(state);
```

## テスト名

- 日本語で記述
- 「何をするか」「どうあるべきか」が分かる表現にする
- 体言止めは使わない

Good:

```typescript
test("複数のAudioItemの合計時間を計算する");
test("AudioItemがない場合は0を返す");
```

Bad (体言止め):

```typescript
test("複数のAudioItemの合計時間を計算");
```

## テストケースの記述

- `test` または `it` で個別のテストケースを定義
- `expect` で検証
