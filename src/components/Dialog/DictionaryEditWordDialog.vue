<template>
  <div v-show="wordEditing" class="col-8 no-wrap text-no-wrap word-editor">
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
        outline
        textColor="display"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="discardOrNotDialog(cancel)"
        >キャンセル</QBtn
      >
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
        :disable="uiLocked || !isWordChanged"
        @click="saveWord"
        >保存</QBtn
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from "vue";
import { QInput } from "quasar";
import { dictionaryManageDialogContextKey } from "./DictionaryManageDialog.vue";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";

const store = useStore();

const context = inject(dictionaryManageDialogContextKey);
if (context == undefined)
  throw new Error(`dictionaryManageDialogContext == undefined`);
const {
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
} = context;

// 音声再生機構
const nowGenerating = ref(false);
const nowPlaying = ref(false);

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

// メニュー系
const yomiInput = ref<QInput>();
const wordPriorityLabels = {
  0: "最低",
  3: "低",
  5: "標準",
  7: "高",
  10: "最高",
};

const yomiFocus = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  yomiInput.value?.focus();
};

const setYomiWhenEnter = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  void setYomi(yomi.value);
};

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
    } catch (e) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw e;
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
    } catch (e) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw e;
    }
  }
  await loadingDictProcess();
  toInitialState();
};

const resetWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語の変更をリセットしますか？",
    message: "単語の変更は破棄されてリセットされます。",
    actionName: "リセットする",
    isWarningColorButton: true,
    cancel: "リセットしない",
  });
  if (result === "OK") {
    selectedId.value = id;
    surface.value = userDict.value[id].surface;
    void setYomi(userDict.value[id].yomi, true);
    wordPriority.value = userDict.value[id].priority;
    toWordEditingState();
  }
};

// アクセント系
const accentPhraseTable = ref<HTMLElement>();

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

// コンテキストメニュー
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
