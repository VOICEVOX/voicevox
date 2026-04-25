<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout>
      <QPageContainer>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >読み方＆アクセント辞書</QToolbarTitle
            >
            <QSpace />
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              @click="discardOrNotDialog(closeDialog)"
            />
          </QToolbar>
        </QHeader>
        <div v-if="loadingDictState" class="loading-dict">
          <div>
            <QSpinner color="primary" size="2.5rem" />
            <div class="q-mt-xs">
              <template v-if="loadingDictState === 'loading'"
                >読み込み中・・・</template
              >
              <template v-if="loadingDictState === 'synchronizing'"
                >同期中・・・</template
              >
            </div>
          </div>
        </div>
        <BaseNavigationView>
          <template #sidebar>
            <div class="list-header">
              <div class="list-title">単語一覧</div>
              <BaseButton
                label="追加"
                icon="add"
                :disabled="uiLocked"
                @click="discardOrNotDialog(newWord)"
              />
            </div>
            <div class="list">
              <BaseListItem
                v-for="(value, key) in userDict"
                :key
                :selected="selectedId === key"
                @click="
                  discardOrNotDialog(() => {
                    editWord(key);
                  })
                "
                @mouseover="hoveredKey = key"
                @mouseleave="hoveredKey = undefined"
              >
                <div class="listitem">
                  <div class="listitem-text">
                    <span class="listitem-surface">
                      {{ value.surface }}
                    </span>
                    <span class="listitem-yomi">
                      {{ value.yomi }}
                    </span>
                  </div>
                  <BaseIconButton
                    v-if="
                      !uiLocked && (hoveredKey === key || selectedId === key)
                    "
                    icon="delete_outline"
                    label="削除"
                    @click.stop="deleteWord(key)"
                  />
                </div>
              </BaseListItem>
            </div>
          </template>

          <DictionaryEditWordDialog />
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script lang="ts">
import type { Ref, ComputedRef, InjectionKey } from "vue";

export const dictionaryManageDialogContextKey: InjectionKey<{
  wordEditing: Ref<boolean>;
  surfaceInput: Ref<typeof BaseTextField | undefined>;
  selectedId: Ref<string>;
  uiLocked: Ref<boolean>;
  userDict: Ref<Record<string, UserDictWord>>;
  isOnlyHiraOrKana: Ref<boolean>;
  accentPhrase: Ref<AccentPhrase | undefined>;
  voiceComputed: ComputedRef<{
    engineId: EngineId;
    speakerId: SpeakerId;
    styleId: StyleId;
  }>;
  surface: Ref<string>;
  yomi: Ref<string>;
  wordPriority: Ref<number>;
  isWordChanged: ComputedRef<boolean>;
  setYomi: (text: string, changeWord?: boolean) => Promise<void>;
  createUILockAction: <T>(action: Promise<T>) => Promise<T>;
  loadingDictProcess: () => Promise<void>;
  computeRegisteredAccent: () => number;
  discardOrNotDialog: (okCallback: () => void) => Promise<void>;
  toInitialState: () => void;
  cancel: () => void;
}> = Symbol("dictionaryManageDialogContextKey");
</script>

<script setup lang="ts">
import { computed, ref, watch, provide } from "vue";
import type BaseTextField from "../Base/BaseTextField.vue";
import BaseListItem from "../Base/BaseListItem.vue";
import BaseIconButton from "../Base/BaseIconButton.vue";
import BaseNavigationView from "../Base/BaseNavigationView.vue";
import BaseButton from "../Base/BaseButton.vue";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { useStore } from "@/store";
import type { AccentPhrase, UserDictWord } from "@/openapi";
import type { EngineId, SpeakerId, StyleId } from "@/type/preload";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";

const defaultDictPriority = 5;

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

const uiLocked = ref(false); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理

// word-list の要素のうち、どの要素がホバーされているか
const hoveredKey = ref<string | undefined>(undefined);

const loadingDictState = ref<null | "loading" | "synchronizing">("loading");
const userDict = ref<Record<string, UserDictWord>>({});

const createUILockAction = function <T>(action: Promise<T>) {
  uiLocked.value = true;
  return action.finally(() => {
    uiLocked.value = false;
  });
};

const loadingDictProcess = async () => {
  if (store.state.engineIds.length === 0)
    throw new Error(`assert engineId.length > 0`);

  loadingDictState.value = "loading";
  try {
    userDict.value = await createUILockAction(
      store.actions.LOAD_ALL_USER_DICT(),
    );
  } catch {
    const result = await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dialogOpened.value = false;
    }
  }
  loadingDictState.value = "synchronizing";
  try {
    await createUILockAction(store.actions.SYNC_ALL_USER_DICT());
  } catch {
    await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の同期に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = null;
};
watch(dialogOpened, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

const wordEditing = ref(false);
const surfaceInput = ref<typeof BaseTextField>();
const selectedId = ref("");
const surface = ref("");
const yomi = ref("");

const voiceComputed = computed(() => {
  const userOrderedCharacterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (userOrderedCharacterInfos == undefined)
    throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
  if (store.state.engineIds.length === 0)
    throw new Error("assert engineId.length > 0");
  const characterInfo = userOrderedCharacterInfos[0].metas;
  const speakerId = characterInfo.speakerUuid;
  const { engineId, styleId } = characterInfo.styles[0];
  return { engineId, speakerId, styleId };
});

const kanaRegex = createKanaRegex();
const isOnlyHiraOrKana = ref(true);
const accentPhrase = ref<AccentPhrase | undefined>();

const setYomi = async (text: string, changeWord?: boolean) => {
  const { engineId, styleId } = voiceComputed.value;

  // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
  isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
  // 読みが変更されていない場合は、アクセントフレーズに変更を加えない
  // ただし、読みが同じで違う単語が存在する場合が考えられるので、changeWordフラグを考慮する
  // 「ガ」が自動挿入されるので、それを考慮してsliceしている
  if (
    text ==
      accentPhrase.value?.moras
        .map((v) => v.text)
        .join("")
        .slice(0, -1) &&
    !changeWord
  ) {
    return;
  }
  if (isOnlyHiraOrKana.value && text.length) {
    text = convertHiraToKana(text);
    text = convertLongVowel(text);
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_ACCENT_PHRASES({
          text: text + "ガ'",
          engineId,
          styleId,
          isKana: true,
        }),
      )
    )[0];
    if (selectedId.value && userDict.value[selectedId.value].yomi === text) {
      accentPhrase.value.accent = computeDisplayAccent();
    }
  } else {
    accentPhrase.value = undefined;
  }
  yomi.value = text;
};

// accent phraseにあるaccentと実際に登録するアクセントには差が生まれる
// アクセントが自動追加される「ガ」に指定されている場合、
// 実際に登録するaccentの値は0となるので、そうなるように処理する
const computeRegisteredAccent = () => {
  if (!accentPhrase.value) throw new Error();
  let accent = accentPhrase.value.accent;
  accent = accent === accentPhrase.value.moras.length ? 0 : accent;
  return accent;
};
// computeの逆
// 辞書から得たaccentが0の場合に、自動で追加される「ガ」の位置にアクセントを表示させるように処理する
const computeDisplayAccent = () => {
  if (!accentPhrase.value || !selectedId.value) throw new Error();
  let accent = userDict.value[selectedId.value].accentType;
  accent = accent === 0 ? accentPhrase.value.moras.length : accent;
  return accent;
};

const wordPriority = ref(defaultDictPriority);

// 操作（ステートの移動）
const isWordChanged = computed(() => {
  if (selectedId.value === "") {
    return (
      surface.value != "" && yomi.value != "" && accentPhrase.value != undefined
    );
  }
  // 一旦代入することで、userDictそのものが更新された時もcomputedするようにする
  const dict = userDict.value;
  const dictData = dict[selectedId.value];
  return (
    dictData &&
    (dictData.surface !== surface.value ||
      dictData.yomi !== yomi.value ||
      dictData.accentType !== computeRegisteredAccent() ||
      dictData.priority !== wordPriority.value)
  );
});

const deleteWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      await createUILockAction(
        store.actions.DELETE_WORD({
          wordUuid: id,
        }),
      );
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
    await loadingDictProcess();
    toInitialState();
  }
};
const discardOrNotDialog = async (okCallback: () => void) => {
  if (isWordChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の追加・変更を破棄しますか？",
      message: "変更を破棄すると、単語の追加・変更はリセットされます。",
      actionName: "破棄する",
      cancel: "破棄しない",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      okCallback();
    }
  } else {
    okCallback();
  }
};
const newWord = () => {
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordPriority.value = defaultDictPriority;
  toWordEditingState();
};
const editWord = (id: string) => {
  selectedId.value = id;
  surface.value = userDict.value[id].surface;
  void setYomi(userDict.value[id].yomi, true);
  wordPriority.value = userDict.value[id].priority;
  toWordEditingState();
};
const cancel = () => {
  toInitialState();
};
const closeDialog = () => {
  toDialogClosedState();
};

// ステートの移動
// 初期状態
const toInitialState = () => {
  wordEditing.value = false;
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordPriority.value = defaultDictPriority;
};
// 単語が編集されている状態
const toWordEditingState = () => {
  wordEditing.value = true;
  surfaceInput.value?.focus();
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dialogOpened.value = false;
};

provide(dictionaryManageDialogContextKey, {
  wordEditing,
  surfaceInput,
  selectedId,
  uiLocked,
  userDict,
  isOnlyHiraOrKana,
  accentPhrase,
  voiceComputed,
  surface,
  yomi,
  wordPriority,
  isWordChanged,
  setYomi,
  createUILockAction,
  loadingDictProcess,
  computeRegisteredAccent,
  discardOrNotDialog,
  toInitialState,
  cancel,
});
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;

.list-header {
  display: flex;
  gap: vars.$gap-1;
  align-items: center;
  justify-content: space-between;
  margin-bottom: vars.$padding-1;
}

.list-title {
  @include mixin.headline-2;
}

.list {
  display: flex;
  flex-direction: column;
  width: 240px;
}

.listitem {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
  width: 100%;
}

.listitem-text {
  display: flex;
  flex-direction: column;
  align-items: start;
  overflow: hidden;
  margin-right: auto;
}

.listitem-surface {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listitem-yomi {
  width: 100%;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-dict {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
