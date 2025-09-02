# 利用規約同意機能 実装計画

## 調査結果まとめ

### **1. テストへの影響**

- 影響なし

### **2. 呼び出し箇所の影響範囲**

- **store/audio.ts 関数の直接呼び出し**: `src/components/Dialog/Dialog.ts` のみ
- **Dialog.ts のラッパー関数の呼び出し**: `src/store/ui.ts` の3つのアクション
  - `SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG`
  - `SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG`
  - `SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG`

### **3. 既存パターン**

- **エラーハンドリング**: `if (result == "canceled") return;` での早期リターン
- **ブランド型**: Zod + `z.string().brand<"TypeName">()` + コンストラクタ関数
- **設定保存**: `acceptRetrieveTelemetry`, `confirmedTips` パターンで永続化
- **audio.tsのgetters**: `ACTIVE_AUDIO_KEY`, `SELECTED_AUDIO_KEYS` パターン

## 実装計画

### **Phase 0: GENERATE_AND_CONNECT_AND_SAVE_AUDIO の引数対応**

#### **0.1 型定義の変更**

**ファイル**: `src/store/type.ts`

```typescript
// GENERATE_AND_CONNECT_AND_SAVE_AUDIOにaudioKeys引数を追加
GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
  action(payload: {
    audioKeys: AudioKey[]; // 新規追加
    filePath?: string;
    callback?: (finishedCount: number, totalCount: number) => void;
  }): SaveResultObject;
};
```

#### **0.2 store/audio.ts の実装変更**

**ファイル**: `src/store/audio.ts`

```typescript
GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
  action({ mutations, actions, state }, { audioKeys, filePath, callback }) {
    const targetAudioKeys = audioKeys;

    // 既存処理でtargetAudioKeysを使用...
  },
},
```

#### **0.3 Dialog.ts での呼び出し修正**

**ファイル**: `src/components/Dialog/Dialog.ts`

```typescript
export async function generateAndConnectAndSaveAudioWithDialog({
  audioKeys,
  actions,
  filePath,
  disableNotifyOnGenerate,
}: {
  audioKeys: AudioKey[];
  actions: DotNotationDispatch<AllActions>;
  filePath?: string;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await withProgress(
    actions.GENERATE_AND_CONNECT_AND_SAVE_AUDIO({
      audioKeys,
      filePath,
      callback: (finishedCount, totalCount) =>
        actions.SET_PROGRESS_FROM_COUNT({ finishedCount, totalCount }),
    }),
    actions,
  );

  notifyResult(result, "audio", actions, disableNotifyOnGenerate);
}
```

### **Phase 1: 基盤実装**

#### **1.1 利用規約同意状態の管理 (リスト形式)**

**ファイル**: `src/type/preload.ts`, `src/store/setting.ts`

```typescript
// HYDRATE_SETTING_STOREに追加
mutations.SET_ACCEPTED_CHARACTER_IDS({
  acceptedCharacterIds: await window.backend.getSetting("acceptedCharacterIds"),
});

// アクション実装
SET_ACCEPTED_CHARACTER_IDS: {
  mutation(state, { acceptedCharacterIds }: { acceptedCharacterIds: SpeakerId[] }) {
    state.acceptedCharacterIds = acceptedCharacterIds;
  },
  action({ mutations }, { acceptedCharacterIds }: { acceptedCharacterIds: SpeakerId[] }) {
    void window.backend.setSetting("acceptedCharacterIds", acceptedCharacterIds);
    mutations.SET_ACCEPTED_CHARACTER_IDS({ acceptedCharacterIds });
  },
},
```

#### **1.2 Vuex getter実装**

**ファイル**: `src/store/audio.ts` (gettersセクション)

```typescript
// audioStore内に追加 (SELECTED_AUDIO_KEYS の後あたり)
GET_UNACCEPTED_CHARACTER_IDS: {
  getter: (state) => (audioKeys: AudioKey[]) => {
    const speakerIds = audioKeys.map(
      (audioKey) => state.audioItems[audioKey].voice.speakerId,
    );
    const uniqueSpeakerIds = Array.from(new Set(speakerIds));

    return uniqueSpeakerIds.filter((speakerId) =>
      !state.acceptedCharacterIds.includes(speakerId),
    );
  },
},
```

#### **1.3 ブランド型の実装**

**ファイル**: `src/type/preload.ts`

```typescript
// 既存のaudioKeySchema の後に追加（実装は Accepted に統一）
export const acceptedAudioKeySchema = z.string().brand<"AcceptedAudioKey">();
export type AcceptedAudioKey = z.infer<typeof acceptedAudioKeySchema>;
export const AcceptedAudioKey = (id: string): AcceptedAudioKey =>
  acceptedAudioKeySchema.parse(id);
```

### **Phase 2: ダイアログ実装**

#### **2.1 利用規約同意ダイアログ**

**ファイル**: `src/components/Dialog/CharacterPolicyAgreementDialog.vue`

**参考実装**:

- **レイアウト**: `UpdateNotificationDialog/Presentation.vue` (QCard + QCardSection)
- **キャラクターリスト**: `CharacterListDialog.vue` の character-items-container
- **カード型UI**: `CharacterTryListenCard.vue` のcard構造

**UI設計**:

- QuasarのQListは使用禁止 → 素のVueで実装
- div + v-for でリスト表示
- 各キャラクターの簡易利用規約をテキスト表示

```vue
<template>
  <QDialog v-model="dialogOpened" persistent>
    <QCard class="policy-dialog">
      <QCardSection>
        <div class="text-h5">キャラクター利用規約への同意</div>
        <div class="text-body2">
          音声を書き出すには以下のキャラクターの利用規約への同意が必要です。
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="scroll">
        <div class="character-policies">
          <div
            v-for="characterInfo in unacceptedCharacterInfos"
            :key="characterInfo.metas.speakerUuid"
            class="character-policy-item"
          >
            <div class="character-name">{{ characterInfo.metas.speakerName }}</div>
            <div class="character-policy">{{ characterInfo.metas.policy }}</div>
          </div>
        </div>
      </QCardSection>

      <QCardActions>
        <QSpace />
        <QBtn label="キャンセル" @click="$emit('cancel')" />
        <QBtn label="同意して続行" color="primary" @click="$emit('accept', characterIds)" />
      </QCardActions>
    </QCard>
  </QDialog>
</template>
```

#### **2.2 Dialog.tsへの統合**

**ファイル**: `src/components/Dialog/Dialog.ts`

```typescript
export async function showCharacterPolicyAgreementDialog({
  unacceptedCharacterInfos,
  actions,
}: {
  unacceptedCharacterInfos: CharacterInfo[];
  actions: DotNotationDispatch<AllActions>;
}): Promise<"accepted" | "canceled"> {
  const { promise, resolve } = Promise.withResolvers<"accepted" | "canceled">();

  Dialog.create({
    component: CharacterPolicyAgreementDialog,
    componentProps: {
      unacceptedCharacterInfos,
    },
  })
    .onOk((acceptedIds) => {
      void actions.SET_ACCEPTED_CHARACTER_IDS({
        acceptedCharacterIds: acceptedIds,
      });
      resolve("accepted");
    })
    .onCancel(() => resolve("canceled"));

  return promise;
}
```

### **Phase 3: UI側でのガード実装**

#### **3.1 UIアクションの追加と呼び出し側の変更**

**ファイル**: `src/store/type.ts`, `src/store/ui.ts`

```typescript
// 型定義
SHOW_CHARACTER_POLICY_AGREEMENT_DIALOG: {
  action(payload: { audioKeys: AudioKey[] }): Promise<"accepted" | "canceled">;
};

// 実装（ui.ts）
SHOW_CHARACTER_POLICY_AGREEMENT_DIALOG: {
  async action({ getters, actions, state }, { audioKeys }) {
    const unacceptedCharacterIds: SpeakerId[] = getters.GET_UNACCEPTED_CHARACTER_IDS(audioKeys);
    if (unacceptedCharacterIds.length === 0) return "accepted" as const;

    const unacceptedCharacterInfos: CharacterInfo[] = Object.values(state.characterInfos)
      .flatMap((infos) => infos)
      .filter((info) => unacceptedCharacterIds.includes(info.metas.speakerUuid));

    return await showCharacterPolicyAgreementDialog({
      unacceptedCharacterInfos,
      actions,
    });
  },
},

// 書き出し系アクションからの呼び出し（例）
const agreementResult = await actions.SHOW_CHARACTER_POLICY_AGREEMENT_DIALOG({ audioKeys: state.audioKeys });
if (agreementResult === "canceled") return;
```

### **Phase 4: ブランド型適用（AcceptedAudioKey）**

#### **4.1 型定義の変更**

**ファイル**: `src/store/type.ts`

```typescript
// AudioStoreTypes内の型定義は AcceptedAudioKey に移行（type.ts では対応済み）
GENERATE_AND_SAVE_AUDIO: {
  action(payload: { acceptedAudioKey: AcceptedAudioKey; filePath?: string }): SaveResultObject;
};
MULTI_GENERATE_AND_SAVE_AUDIO: {
  action(payload: { acceptedAudioKeys: AcceptedAudioKey[]; dirPath?: string; callback?: (finishedCount: number) => void }): SaveResultObject[] | "canceled";
};
GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
  action(payload: { acceptedAudioKeys: AcceptedAudioKey[]; filePath?: string; callback?: (finishedCount: number, totalCount: number) => void }): SaveResultObject;
};
```

#### **4.2 store/audio.ts の関数実装変更**

**ファイル**: `src/store/audio.ts`

```typescript
// 実装側（audio.ts）は段階的に移行する（まずはパラメータ名の統一 → ブランド型適用）
// 既存のロジックは維持しつつ、呼び出し側からのAcceptedブランド適用を最終段で行う。
```

## 懸念点と対応策

### **1. ブランド型導入の波及影響**

**懸念**: ブランド型適用に伴う型整合性（type.ts と実装のずれ）
**対応**: まずUI側ガードの完成を優先し、後続で`AcceptedAudioKey`に段階移行。呼び出し箇所の影響を最小化するために関数シグネチャの変更は最後にまとめて実施。

### **3. UI実装の制約**

**制約**: QuasarのList/QExpansionItem使用禁止
**対応**: 素のVueでカード型リスト実装
**参考**: `CharacterTryListenCard.vue` のスタイリング

### **4. エラーハンドリングの一貫性**

**既存パターン踏襲**: `"canceled"` リテラル + 早期リターン
**参考**: ui.ts の `if (agreementResult === "canceled") return;`

## 段階的実装のメリット

0. **Phase 0**: API統一 → GENERATE_AND_CONNECT_AND_SAVE_AUDIOのaudioKeys引数対応
1. **Phase 1**: 基盤実装 → 設定保存・getter追加、型エラーなし
2. **Phase 2**: ダイアログ実装 → UI単体テスト可能
3. **Phase 3**: UI統合 → 実際の書き出しフローで動作確認
4. **Phase 4**: ブランド型適用 → タイプセーフティ強化、型安全な書き出し保証

この段階的アプローチにより、リスクを最小化しながら確実に実装できます。

## 補足

### **参考実装ファイル**

- **設定管理**: `src/store/setting.ts` の `SET_CONFIRMED_TIPS` パターン
- **ダイアログレイアウト**: `UpdateNotificationDialog/Presentation.vue`
- **キャラクターリスト**: `CharacterListDialog.vue` の character-items-container
- **カード型UI**: `CharacterTryListenCard.vue`
- **getter実装**: `src/store/audio.ts` の `SELECTED_AUDIO_KEYS` パターン

---

* 他のメモ
  * acceptedCharacterIdsが何なのかのドキュメントメモ書きたい
