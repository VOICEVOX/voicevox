<template>
  <QDialog
    v-model="dictionaryManageDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
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
              :disable="wordEditing"
              @click="discardOrNotDialog(closeDialog)"
            />
          </QToolbar>
        </QHeader>
        <QPage class="row">
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
          <div class="col-4 word-list-col">
            <div
              v-if="wordEditing"
              class="word-list-disable-overlay"
              @click="discardOrNotDialog(cancel)"
            />
            <div class="word-list-header text-no-wrap">
              <div class="row word-list-title">
                <span class="text-h5 col-8">単語一覧</span>
                <QBtn
                  outline
                  textColor="display"
                  class="text-no-wrap text-bold col"
                  :disable="uiLocked"
                  @click="newWord"
                  >追加</QBtn
                >
              </div>
            </div>
            <QList class="word-list">
              <QItem
                v-for="(value, key) in userDict"
                :key
                v-ripple
                tag="label"
                clickable
                :active="selectedId === key"
                activeClass="active-word"
                @click="selectWord(key)"
                @dblclick="editWord"
                @mouseover="hoveredKey = key"
                @mouseleave="hoveredKey = undefined"
              >
                <QItemSection>
                  <QItemLabel lines="1" class="text-display">{{
                    value.surface
                  }}</QItemLabel>
                  <QItemLabel lines="1" caption>{{ value.yomi }}</QItemLabel>
                </QItemSection>

                <QItemSection
                  v-if="!uiLocked && (hoveredKey === key || selectedId === key)"
                  side
                >
                  <div class="q-gutter-xs">
                    <QBtn
                      size="12px"
                      flat
                      dense
                      round
                      icon="edit"
                      @click.stop="
                        selectWord(key);
                        editWord();
                      "
                    >
                      <QTooltip :delay="500">編集</QTooltip>
                    </QBtn>
                    <QBtn
                      size="12px"
                      flat
                      dense
                      round
                      icon="delete_outline"
                      @click.stop="
                        selectWord(key);
                        deleteWord();
                      "
                    >
                      <QTooltip :delay="500">削除</QTooltip>
                    </QBtn>
                  </div>
                </QItemSection>
              </QItem>
            </QList>
          </div>

          <!-- 右側のpane -->
          <DictionaryEditWordDialog
            :wordEditing
            :isWordChanged
            :selectedId
            :surface
            :yomi
            :voiceComputed
            :isOnlyHiraOrKana
            :accentPhrase
            :wordPriority
            :uiLocked
            :userDict
            @setYomi="setYomi"
            @createUILockAction="createUILockAction"
            @loadingDictProcess="loadingDictProcess"
            @computeRegisteredAccent="computeRegisteredAccent"
            @discardOrNotDialog="discardOrNotDialog"
            @toWordEditingState="toWordEditingState"
            @cancel="cancel"
            @toInitialState="toInitialState"
            @updateSelectedId="updateSelectedId"
            @updateSurface="updateSurface"
            @updateAccentPhraseValue="updateAccentPhraseValueAccent"
            @updateAccentPhrase="updateAccentPhrase"
            @updateWordPriority="updateWordPriority"
          ></DictionaryEditWordDialog>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { useStore } from "@/store";
import { AccentPhrase, UserDictWord } from "@/openapi";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";

const defaultDictPriority = 5;

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const store = useStore();

const dictionaryManageDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
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
      store.dispatch("LOAD_ALL_USER_DICT"),
    );
  } catch {
    const result = await store.dispatch("SHOW_ALERT_DIALOG", {
      title: "辞書の取得に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dictionaryManageDialogOpenedComputed.value = false;
    }
  }
  loadingDictState.value = "synchronizing";
  try {
    await createUILockAction(store.dispatch("SYNC_ALL_USER_DICT"));
  } catch {
    await store.dispatch("SHOW_ALERT_DIALOG", {
      title: "辞書の同期に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = null;
};
watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

const wordEditing = ref(false);
const selectedId = ref("");
const surface = ref("");
const yomi = ref("");

const updateSelectedId = (newId: string) => {
  selectedId.value = newId;
};

const updateSurface = (newSurface: string) => {
  surface.value = newSurface;
};

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

const updateAccentPhraseValueAccent = (
  newAccentPhraseValueAccent: number | undefined,
) => {
  if (accentPhrase.value && newAccentPhraseValueAccent != undefined) {
    accentPhrase.value.accent = newAccentPhraseValueAccent;
  }
};

const updateAccentPhrase = (newAccentPhrase: AccentPhrase | undefined) => {
  accentPhrase.value = newAccentPhrase;
};

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
        store.dispatch("FETCH_ACCENT_PHRASES", {
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

const updateWordPriority = (newPriority: number) => {
  wordPriority.value = newPriority;
};

// 操作（ステートの移動）
const isWordChanged = computed(() => {
  if (selectedId.value === "") {
    return surface.value && yomi.value && accentPhrase.value;
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

const deleteWord = async () => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "登録された単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除",
  });
  if (result === "OK") {
    try {
      await createUILockAction(
        store.dispatch("DELETE_WORD", {
          wordUuid: selectedId.value,
        }),
      );
    } catch {
      void store.dispatch("SHOW_ALERT_DIALOG", {
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
    const result = await store.dispatch("SHOW_WARNING_DIALOG", {
      title: "単語の追加・変更を破棄しますか？",
      message: "破棄すると、単語の追加・変更はリセットされます。",
      actionName: "破棄",
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
  editWord();
};
const editWord = () => {
  toWordEditingState();
};
const selectWord = (id: string) => {
  selectedId.value = id;
  surface.value = userDict.value[id].surface;
  void setYomi(userDict.value[id].yomi, true);
  wordPriority.value = userDict.value[id].priority;
  toWordSelectedState();
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
// 単語が選択されているだけの状態
const toWordSelectedState = () => {
  wordEditing.value = false;
};
// 単語が編集されている状態
const toWordEditingState = () => {
  wordEditing.value = true;
  // surfaceInput.value?.focus();
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.word-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.word-list-header {
  margin: 1rem;

  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .word-list-title {
    flex-grow: 1;
  }
}

.word-list {
  // menubar-height + toolbar-height + window-border-width +
  // 36(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width + 36px + 30px}
  );
  width: 100%;
  overflow-y: auto;
  padding-bottom: 16px;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
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

.word-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

.word-editor {
  display: flex;
  flex-flow: column;
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  ) !important;
  overflow: auto;
}

.word-input {
  padding-left: 10px;
  width: calc(66vw - 80px);

  :deep(.q-field__control) {
    height: 2rem;
  }

  :deep(.q-placeholder) {
    padding: 0;
    font-size: 20px;
  }

  :deep(.q-field__after) {
    height: 2rem;
  }
}

.desc-row {
  color: rgba(colors.$display-rgb, 0.5);
  font-size: 12px;
}

.play-button {
  margin: auto 0;
  padding-right: 16px;
}

.accent-phrase-table {
  flex-grow: 1;
  align-self: stretch;

  display: flex;
  height: 130px;
  overflow-x: scroll;
  width: calc(66vw - 140px);

  .mora-table {
    display: inline-grid;
    align-self: stretch;
    grid-template-rows: 1fr 60px 30px;

    .text-cell {
      padding: 0;
      min-width: 20px;
      max-width: 20px;
      grid-row-start: 3;
      text-align: center;
      white-space: nowrap;
      color: colors.$display;
      position: relative;
    }

    .splitter-cell {
      min-width: 20px;
      max-width: 20px;
      grid-row: 3 / span 1;
      z-index: vars.$detail-view-splitter-cell-z-index;
    }
  }
}

.save-delete-reset-buttons {
  padding: 20px;

  display: flex;
  flex: 1;
  align-items: flex-end;
}
</style>
