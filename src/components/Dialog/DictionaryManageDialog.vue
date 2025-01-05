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

          <!-- 左側のpane -->
          <div class="col-4 word-list-col">
            <div
              v-if="wordEditing"
              class="word-list-disable-overlay"
              @click="discardOrNotDialog(cancel)"
            />
            <div class="word-list-header text-no-wrap col">
              <div class="row">
                <span class="word-list-header-text text-h5">単語一覧</span>
                <QSpace />
                <QBtn
                  outline
                  textColor="display"
                  class="text-no-wrap text-bold"
                  :disable="uiLocked"
                  @click="newWord"
                  >追加</QBtn
                >
                <QBtn
                  round
                  flat
                  icon="more_horiz"
                  color="display"
                  :disable="wordEditing"
                >
                  <QMenu>
                    <QList>
                      <QItem v-ripple>
                        <QItemSection side>
                          <QCheckbox
                            v-model="showPriorityOnDictionary"
                            @click="OnClickShowPriorityOnDictionary"
                            >優先度をリストに表示する</QCheckbox
                          >
                        </QItemSection>
                      </QItem>
                    </QList>
                  </QMenu>
                </QBtn>
              </div>
              <div class="row">
                <QSelect v-model="sortType" class="col" :options="sortTypes"
                  ><template #prepend> <QIcon name="swap_vert" /> </template
                ></QSelect>
                <QCheckbox
                  v-model="isDesc"
                  checkedIcon="arrow_upward"
                  uncheckedIcon="arrow_downward"
                  keepColor
                  color="display"
                />
              </div>
              <QInput
                v-model="wordFilter"
                icon="search"
                hideBottomSpace
                dense
                placeholder="検索"
                color="display"
                :disable="uiLocked || wordEditing"
                class="q-mr-sm search-box"
                ><template #prepend> <QIcon name="search" /> </template
              ></QInput>
            </div>
            <QList class="word-list">
              <QItem
                v-for="(value, key) in filteredUserDict"
                :key
                v-ripple
                tag="label"
                clickable
                :active="selectedId === key"
                activeClass="active-word"
                @click="selectWord(String(key))"
                @dblclick="editWord"
                @mouseover="hoveredKey = String(key)"
                @mouseleave="hoveredKey = undefined"
              >
                <QItemSection>
                  <QItemLabel lines="1" class="text-display">{{
                    value.surface
                  }}</QItemLabel>
                  <QItemLabel lines="1" caption
                    ><template v-if="showPriorityOnDictionary">
                      [{{ value.priority }}] </template
                    >{{ value.yomi }}</QItemLabel
                  >
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

          <DictionaryEditWordDialog />
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script lang="ts">
import { Ref, ComputedRef } from "vue";

export const dictionaryManageDialogContextKey = "dictionaryManageDialogContext";

export interface DictionaryManageDialogContext {
  wordEditing: Ref<boolean>;
  surfaceInput: Ref<QInput | undefined>;
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
  toWordEditingState: () => void;
  cancel: () => void;
}
</script>

<script setup lang="ts">
import { computed, ref, watch, provide } from "vue";
import { QInput } from "quasar";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { useStore } from "@/store";
import { AccentPhrase, UserDictWord } from "@/openapi";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";
import {
  convertHankakuToZenkaku,
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

// 検索結果でフィルタリングされたユーザ辞書
const filteredUserDict = computed(() => {
  return Object.fromEntries(
    Object.entries(userDict.value)
      .sort((a, b) => {
        let order;
        switch (sortType.value.value) {
          case "yomi":
            order = a[1].yomi.localeCompare(b[1].yomi);
            break;
          case "priority":
            order = b[1].priority - a[1].priority;
            break;
          default:
            order = 0;
            break;
        }
        return order * (isDesc.value ? -1 : 1);
      })
      .filter(([, value]) => {
        // 半角から全角に変換
        let searchWord = convertHankakuToZenkaku(wordFilter.value);
        // ひらがなからカタカナに変換
        searchWord = convertHiraToKana(searchWord);
        // 長音を適切な音に変換
        const searchWordLongVowel = convertLongVowel(searchWord);
        return (
          value.surface.includes(searchWord) ||
          value.yomi.includes(searchWord) ||
          value.surface.includes(searchWordLongVowel) ||
          value.yomi.includes(searchWordLongVowel)
        );
      }),
  );
});

// 表示順
const sortTypes = [
  {
    label: "読み順",
    value: "yomi",
  },
  {
    label: "優先度順",
    value: "priority",
  },
];
const sortType = ref(sortTypes[0]);

// 降順か？
const isDesc = ref(false);

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
      dictionaryManageDialogOpenedComputed.value = false;
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
watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

const wordFilter = ref("");

const wordEditing = ref(false);
const surfaceInput = ref<QInput>();
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

// 優先度表示
const showPriorityOnDictionaryKey = "ShowPriorityOnDictionary";
const showPriorityOnDictionary = ref(
  localStorage.getItem(showPriorityOnDictionaryKey) === "true",
);
// 優先度表示の変更があった時に呼ばれるイベント
const OnClickShowPriorityOnDictionary = () => {
  localStorage.setItem(
    showPriorityOnDictionaryKey,
    showPriorityOnDictionary.value.toString(),
  );
};

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

const deleteWord = async () => {
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
          wordUuid: selectedId.value,
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
  surfaceInput.value?.focus();
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};

provide<DictionaryManageDialogContext>(dictionaryManageDialogContextKey, {
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
  toWordEditingState,
  cancel,
});
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.word-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.word-list-header-text {
  display: flex;
  justify-content: center;
  align-items: center;
}

.word-list-header {
  margin: 1rem;
  align-items: center;
  vertical-align: middle;
  justify-content: space-between;
}

.word-list {
  // menubar-height + toolbar-height + window-border-width +
  // 140(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width + 140px + 30px}
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
</style>
