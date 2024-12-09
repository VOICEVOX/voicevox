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
              <div class="word-list-title row">
                <span class="text-h5">単語一覧</span>
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
                          <QCheckbox v-model="showPriorityOnDictionary"
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
                @click="selectWord(key)"
                @dblclick="editWord"
                @mouseover="hoveredKey = key"
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

          <!-- 右側のpane -->
          <div
            v-show="wordEditing"
            class="col-8 no-wrap text-no-wrap word-editor"
          >
            <div class="row q-pl-md q-mt-md">
              <div class="text-h6">単語</div>
              <QInput
                ref="surfaceInput"
                v-model="surface"
                class="word-input"
                dense
                :disable="uiLocked"
                @focus="clearSurfaceInputSelection()"
                @blur="setSurface(surface)"
                @keydown.enter="yomiFocus"
              >
                <ContextMenu
                  ref="surfaceContextMenu"
                  :header="surfaceContextMenuHeader"
                  :menudata="surfaceContextMenudata"
                  @beforeShow="startSurfaceContextMenuOperation()"
                  @beforeHide="endSurfaceContextMenuOperation()"
                />
              </QInput>
            </div>
            <div class="row q-pl-md q-pt-sm">
              <div class="text-h6">読み</div>
              <QInput
                ref="yomiInput"
                v-model="yomi"
                class="word-input q-pb-none"
                dense
                :error="!isOnlyHiraOrKana"
                :disable="uiLocked"
                @focus="clearYomiInputSelection()"
                @blur="setYomi(yomi)"
                @keydown.enter="setYomiWhenEnter"
              >
                <template #error>
                  読みに使える文字はひらがなとカタカナのみです。
                </template>
                <ContextMenu
                  ref="yomiContextMenu"
                  :header="yomiContextMenuHeader"
                  :menudata="yomiContextMenudata"
                  @beforeShow="startYomiContextMenuOperation()"
                  @beforeHide="endYomiContextMenuOperation()"
                />
              </QInput>
            </div>
            <div class="row q-pl-md q-mt-lg text-h6">アクセント調整</div>
            <div class="row q-pl-md desc-row">
              語尾のアクセントを考慮するため、「が」が自動で挿入されます。
            </div>
            <div class="row q-px-md" style="height: 130px">
              <div class="play-button">
                <QBtn
                  v-if="!nowPlaying && !nowGenerating"
                  fab
                  color="primary"
                  textColor="display-on-primary"
                  icon="play_arrow"
                  @click="play"
                />
                <QBtn
                  v-else
                  fab
                  color="primary"
                  textColor="display-on-primary"
                  icon="stop"
                  :disable="nowGenerating"
                  @click="stop"
                />
              </div>
              <div
                ref="accentPhraseTable"
                class="accent-phrase-table overflow-hidden-y"
              >
                <div v-if="accentPhrase" class="mora-table">
                  <AudioAccent
                    :accentPhrase
                    :accentPhraseIndex="0"
                    :uiLocked
                    :onChangeAccent="changeAccent"
                  />
                  <template
                    v-for="(mora, moraIndex) in accentPhrase.moras"
                    :key="moraIndex"
                  >
                    <div
                      class="text-cell"
                      :style="{
                        gridColumn: `${moraIndex * 2 + 1} / span 1`,
                      }"
                    >
                      {{ mora.text }}
                    </div>
                    <div
                      v-if="moraIndex < accentPhrase.moras.length - 1"
                      class="splitter-cell"
                      :style="{
                        gridColumn: `${moraIndex * 2 + 2} / span 1`,
                      }"
                    />
                  </template>
                </div>
              </div>
            </div>
            <div class="row q-pl-md q-pt-lg text-h6">単語優先度</div>
            <div class="row q-pl-md desc-row">
              単語を登録しても反映されない場合は優先度を高くしてください。
            </div>
            <div
              class="row q-px-md"
              :style="{
                justifyContent: 'center',
              }"
            >
              <QSlider
                v-model="wordPriority"
                snap
                dense
                color="primary"
                markers
                :min="0"
                :max="10"
                :step="1"
                :markerLabels="wordPriorityLabels"
                :style="{
                  width: '80%',
                }"
              />
            </div>
            <div class="row q-px-md save-delete-reset-buttons">
              <QSpace />
              <QBtn
                v-show="!!selectedId"
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !isWordChanged"
                @click="resetWord(selectedId)"
                >リセット</QBtn
              >
              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked"
                @click="discardOrNotDialog(cancel)"
                >キャンセル</QBtn
              >
              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !isWordChanged"
                @click="saveWord"
                >保存</QBtn
              >
            </div>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { QInput } from "quasar";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";
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
const nowGenerating = ref(false);
const nowPlaying = ref(false);

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
            console.log("YOMI: " + a[1].yomi + ", " + b[1].yomi);
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
const yomiInput = ref<QInput>();
const yomiFocus = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  yomiInput.value?.focus();
};
const setYomiWhenEnter = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  void setYomi(yomi.value);
};

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
const accentPhraseTable = ref<HTMLElement>();

const convertHankakuToZenkaku = (text: string) => {
  // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

  // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};
const setSurface = (text: string) => {
  // surfaceを全角化する
  // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
  // 入力後に自動で変換するようにする
  surface.value = convertHankakuToZenkaku(text);
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

const changeAccent = async (_: number, accent: number) => {
  const { engineId, styleId } = voiceComputed.value;

  if (accentPhrase.value) {
    accentPhrase.value.accent = accent;
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_MORA_DATA({
          accentPhrases: [accentPhrase.value],
          engineId,
          styleId,
        }),
      )
    )[0];
  }
};

const play = async () => {
  if (!accentPhrase.value) return;

  nowGenerating.value = true;
  const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
    text: yomi.value,
    voice: voiceComputed.value,
  });

  if (audioItem.query == undefined)
    throw new Error(`assert audioItem.query !== undefined`);

  audioItem.query.accentPhrases = [accentPhrase.value];

  let fetchAudioResult: FetchAudioResult;
  try {
    fetchAudioResult = await store.actions.FETCH_AUDIO_FROM_AUDIO_ITEM({
      audioItem,
    });
  } catch (e) {
    window.backend.logError(e);
    nowGenerating.value = false;
    void store.actions.SHOW_ALERT_DIALOG({
      title: "生成に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    return;
  }

  const { blob } = fetchAudioResult;
  nowGenerating.value = false;
  nowPlaying.value = true;
  await store.actions.PLAY_AUDIO_BLOB({ audioBlob: blob });
  nowPlaying.value = false;
};
const stop = () => {
  void store.actions.STOP_AUDIO();
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
const wordPriorityLabels = {
  0: "最低",
  3: "低",
  5: "標準",
  7: "高",
  10: "最高",
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
const saveWord = async () => {
  if (!accentPhrase.value) throw new Error(`accentPhrase === undefined`);
  const accent = computeRegisteredAccent();
  if (selectedId.value) {
    try {
      await store.actions.REWRITE_WORD({
        wordUuid: selectedId.value,
        surface: surface.value,
        pronunciation: yomi.value,
        accentType: accent,
        priority: wordPriority.value,
      });
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
  } else {
    try {
      await createUILockAction(
        store.actions.ADD_WORD({
          surface: surface.value,
          pronunciation: yomi.value,
          accentType: accent,
          priority: wordPriority.value,
        }),
      );
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
  }
  await loadingDictProcess();
  toInitialState();
};
const deleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "登録された単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除",
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
const resetWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語の変更をリセットしますか？",
    message: "単語の変更は破棄されてリセットされます。",
    actionName: "リセット",
  });
  if (result === "OK") {
    selectedId.value = id;
    surface.value = userDict.value[id].surface;
    void setYomi(userDict.value[id].yomi, true);
    wordPriority.value = userDict.value[id].priority;
    toWordEditingState();
  }
};
const discardOrNotDialog = async (okCallback: () => void) => {
  if (isWordChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
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
  surfaceInput.value?.focus();
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};

const surfaceContextMenu = ref<InstanceType<typeof ContextMenu>>();
const yomiContextMenu = ref<InstanceType<typeof ContextMenu>>();

const {
  contextMenuHeader: surfaceContextMenuHeader,
  contextMenudata: surfaceContextMenudata,
  startContextMenuOperation: startSurfaceContextMenuOperation,
  clearInputSelection: clearSurfaceInputSelection,
  endContextMenuOperation: endSurfaceContextMenuOperation,
} = useRightClickContextMenu(surfaceContextMenu, surfaceInput, surface);

const {
  contextMenuHeader: yomiContextMenuHeader,
  contextMenudata: yomiContextMenudata,
  startContextMenuOperation: startYomiContextMenuOperation,
  clearInputSelection: clearYomiInputSelection,
  endContextMenuOperation: endYomiContextMenuOperation,
} = useRightClickContextMenu(yomiContextMenu, yomiInput, yomi);
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
