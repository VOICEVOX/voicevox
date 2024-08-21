<template>
  <div v-show="wordEditing" class="col-8 no-wrap text-no-wrap word-editor">
    <div class="row q-pl-md q-mt-md">
      <div class="text-h6">単語</div>
      <QInput
        ref="surfaceInput"
        :modelValue="$props.surface"
        :disable="$props.uiLocked"
        class="word-input"
        dense
        @update="onUpdateSurface"
        @focus="clearSurfaceInputSelection()"
        @blur="setSurface(props.surface)"
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
        :modelValue="$props.yomi"
        :disable="uiLocked"
        class="word-input q-pb-none"
        :error="!$props.isOnlyHiraOrKana"
        dense
        @update="onUpdateYomi"
        @focus="clearYomiInputSelection()"
        @blur="$props.setYomi(props.yomi)"
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
            v-if="$props.accentPhrase"
            :accentPhrase="$props.accentPhrase"
            :accentPhraseIndex="0"
            :uiLocked
            :onChangeAccent="changeAccent"
          />
          <template
            v-for="(mora, moraIndex) in $props.accentPhrase
              ? $props.accentPhrase.moras
              : []"
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
              v-if="
                moraIndex <
                ($props.accentPhrase
                  ? $props.accentPhrase.moras.length - 1
                  : -1)
              "
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
        v-model="$props.wordPriority"
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
        v-show="!!props.selectedId"
        outline
        textColor="display"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked || !isWordChanged"
        @click="resetWord(props.selectedId)"
        >リセット</QBtn
      >
      <QBtn
        outline
        textColor="display"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="$props.uiLocked"
        @click="$props.discardOrNotDialog(props.cancel)"
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import { QInput } from "quasar";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu.vue";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import type { FetchAudioResult } from "@/store/type";
import { useStore } from "@/store";
import { AccentPhrase, UserDictWord } from "@/openapi";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";

const props = defineProps<{
  wordEditing: boolean;
  isWordChanged: boolean | "" | AccentPhrase | undefined;
  selectedId: string;
  surface: string;
  yomi: string;
  voiceComputed: {
    engineId: string & EngineId;
    speakerId: string & SpeakerId;
    styleId: number & StyleId;
  };
  isOnlyHiraOrKana: boolean;
  accentPhrase: AccentPhrase | undefined;
  wordPriority: number;
  uiLocked: boolean;
  userDict: Record<string, UserDictWord>;
  setYomi: (text: string, changeWord?: boolean) => Promise<void>;
  createUILockAction: <T>(action: Promise<T>) => Promise<T>;
  loadingDictProcess: () => Promise<void>;
  computeRegisteredAccent: () => number;
  discardOrNotDialog: (okCallback: () => void) => Promise<void>;
  toWordEditingState: () => void;
  cancel: () => void;
  toInitialState: () => void;
}>();

const emit = defineEmits<{
  (e: "updateSelectedId", newId: string): void;
  (e: "updateSurface", newSurface: string): void;
  (e: "updateYomi", newYomi: string): void;
  (
    e: "updateAccentPhraseValueAccent",
    newAccentPhraseValueAccent: number,
  ): void;
  (e: "updateAccentPhrase", newAccentPhrase: AccentPhrase | undefined): void;
  (e: "updateWordPriority", newPriority: number): void;
}>();

const surfaceInput = ref<QInput>();
const yomiInput = ref<QInput>();
const accentPhraseTable = ref<HTMLElement>();
const nowGenerating = ref(false);
const nowPlaying = ref(false);
const store = useStore();
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
  void props.setYomi(props.yomi);
};

const setSurface = (text: string) => {
  // surfaceを全角化する
  // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
  // 入力後に自動で変換するようにする
  const convertedText = convertHankakuToZenkaku(text);
  emit("updateSurface", convertedText);
};

const convertHankakuToZenkaku = (text: string) => {
  // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

  // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};

const changeAccent = async (_: number, accent: number) => {
  const { engineId, styleId } = props.voiceComputed;

  if (props.accentPhrase) {
    emit("updateAccentPhraseValueAccent", accent);
    const newAccentPhrase = (
      await props.createUILockAction(
        store.dispatch("FETCH_MORA_DATA", {
          accentPhrases: [props.accentPhrase],
          engineId,
          styleId,
        }),
      )
    )[0];
    emit("updateAccentPhrase", newAccentPhrase);
  }
};

const play = async () => {
  if (!props.accentPhrase) return;

  nowGenerating.value = true;
  const audioItem = await store.dispatch("GENERATE_AUDIO_ITEM", {
    text: props.yomi,
    voice: props.voiceComputed,
  });

  if (audioItem.query == undefined)
    throw new Error(`assert audioItem.query !== undefined`);

  audioItem.query.accentPhrases = [props.accentPhrase];

  let fetchAudioResult: FetchAudioResult;
  try {
    fetchAudioResult = await store.dispatch("FETCH_AUDIO_FROM_AUDIO_ITEM", {
      audioItem,
    });
  } catch (e) {
    window.backend.logError(e);
    nowGenerating.value = false;
    void store.dispatch("SHOW_ALERT_DIALOG", {
      title: "生成に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    return;
  }

  const { blob } = fetchAudioResult;
  nowGenerating.value = false;
  nowPlaying.value = true;
  await store.dispatch("PLAY_AUDIO_BLOB", { audioBlob: blob });
  nowPlaying.value = false;
};

const stop = () => {
  void store.dispatch("STOP_AUDIO");
};

const saveWord = async () => {
  if (!props.accentPhrase) throw new Error(`accentPhrase === undefined`);
  const accent = props.computeRegisteredAccent();
  if (props.selectedId) {
    try {
      await store.dispatch("REWRITE_WORD", {
        wordUuid: props.selectedId,
        surface: props.surface,
        pronunciation: props.yomi,
        accentType: accent,
        priority: props.wordPriority,
      });
    } catch {
      void store.dispatch("SHOW_ALERT_DIALOG", {
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
  } else {
    try {
      await props.createUILockAction(
        store.dispatch("ADD_WORD", {
          surface: props.surface,
          pronunciation: props.yomi,
          accentType: accent,
          priority: props.wordPriority,
        }),
      );
    } catch {
      void store.dispatch("SHOW_ALERT_DIALOG", {
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
  }
  await props.loadingDictProcess();
  props.toInitialState();
};

const resetWord = async (id: string) => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "単語の変更をリセットしますか？",
    message: "単語の変更は破棄されてリセットされます。",
    actionName: "リセット",
  });
  if (result === "OK") {
    emit("updateSelectedId", id);
    emit("updateSurface", props.userDict[id].surface);
    void props.setYomi(props.userDict[id].yomi, true);
    emit("updateWordPriority", props.userDict[id].priority);
    props.toWordEditingState();
  }
};

const surfaceContextMenu = ref<InstanceType<typeof ContextMenu>>();
const yomiContextMenu = ref<InstanceType<typeof ContextMenu>>();
const surfaceRef = ref(props.surface);
const yomiRef = ref(props.yomi);

const {
  contextMenuHeader: surfaceContextMenuHeader,
  contextMenudata: surfaceContextMenudata,
  startContextMenuOperation: startSurfaceContextMenuOperation,
  clearInputSelection: clearSurfaceInputSelection,
  endContextMenuOperation: endSurfaceContextMenuOperation,
} = useRightClickContextMenu(surfaceContextMenu, surfaceInput, surfaceRef);

const {
  contextMenuHeader: yomiContextMenuHeader,
  contextMenudata: yomiContextMenudata,
  startContextMenuOperation: startYomiContextMenuOperation,
  clearInputSelection: clearYomiInputSelection,
  endContextMenuOperation: endYomiContextMenuOperation,
} = useRightClickContextMenu(yomiContextMenu, yomiInput, yomiRef);
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
