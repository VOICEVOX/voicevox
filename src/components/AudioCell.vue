<template>
  <div class="audio-cell">
    <q-icon
      v-if="isActiveAudioCell"
      name="arrow_right"
      color="primary-light"
      size="sm"
      class="absolute active-arrow"
    />
    <div
      class="line-number"
      :class="{ active: isActiveAudioCell }"
      v-if="showTextLineNumber"
    >
      {{ textLineNumberIndex }}
    </div>
    <character-button
      :character-infos="userOrderedCharacterInfos"
      :loading="isInitializingSpeaker"
      :show-engine-info="isMultipleEngine"
      :ui-locked="uiLocked"
      v-model:selected-voice="selectedVoice"
    />
    <q-input
      ref="textfield"
      filled
      dense
      hide-bottom-space
      class="full-width"
      color="primary-light"
      :disable="uiLocked"
      :error="audioTextBuffer.length >= 80"
      :model-value="audioTextBuffer"
      @update:model-value="setAudioTextBuffer"
      @blur="willRemove || pushAudioText()"
      @paste="pasteOnAudioCell"
      @focus="setActiveAudioKey()"
      @keydown.prevent.up.exact="moveUpCell"
      @keydown.prevent.down.exact="moveDownCell"
      @keydown.prevent.enter.exact="willRemove || pushAudioText()"
      :aria-label="`${textLineNumberIndex}行目`"
    >
      <template v-slot:error>
        文章が長いと正常に動作しない可能性があります。
        句読点の位置で文章を分割してください。
      </template>
      <template #after v-if="deleteButtonEnable">
        <q-btn
          round
          flat
          icon="delete_outline"
          size="0.8rem"
          :disable="uiLocked"
          @click="removeCell"
          :aria-label="`${textLineNumberIndex}行目を削除`"
        />
      </template>
      <context-menu :menudata="contextMenudata" />
    </q-input>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from "vue";
import { QInput } from "quasar";
import CharacterButton from "@/components/CharacterButton.vue";
import ContextMenu, { ContextMenuItemData } from "@/components/ContextMenu.vue";
import { useStore } from "@/store";
import { AudioKey, Voice } from "@/type/preload";
import { QInputSelectionHelper } from "@/helpers/QInputSelectionHelper";

const props =
  defineProps<{
    audioKey: AudioKey;
  }>();

const emit =
  defineEmits<{
    (e: "focusCell", payload: { audioKey: AudioKey }): void;
  }>();

defineExpose({
  audioKey: computed(() => props.audioKey),
  focusTextField: () => {
    textfield.value?.focus();
  },
  removeCell: () => {
    removeCell();
  },
});

const store = useStore();
const userOrderedCharacterInfos = computed(() => {
  const infos = store.getters.USER_ORDERED_CHARACTER_INFOS;
  if (infos == undefined)
    throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
  return infos;
});
const isInitializingSpeaker = computed(
  () => store.state.audioKeyInitializingSpeaker === props.audioKey
);
const audioItem = computed(() => store.state.audioItems[props.audioKey]);

const uiLocked = computed(() => store.getters.UI_LOCKED);

const selectedVoice = computed<Voice | undefined>({
  get() {
    const { engineId, styleId } = audioItem.value.voice;

    if (
      !store.state.engineIds.some((storeEngineId) => storeEngineId === engineId)
    )
      return undefined;

    const speakerInfo =
      userOrderedCharacterInfos.value != undefined
        ? store.getters.CHARACTER_INFO(engineId, styleId)
        : undefined;

    if (speakerInfo == undefined) return undefined;
    return { engineId, speakerId: speakerInfo.metas.speakerUuid, styleId };
  },
  set(voice: Voice | undefined) {
    if (voice == undefined) return;
    store.dispatch("COMMAND_CHANGE_VOICE", {
      audioKey: props.audioKey,
      voice,
    });
  },
});

const isActiveAudioCell = computed(
  () => props.audioKey === store.getters.ACTIVE_AUDIO_KEY
);

const audioTextBuffer = ref(audioItem.value.text);
const isChangeFlag = ref(false);
const setAudioTextBuffer = (text: string | number | null) => {
  if (typeof text !== "string") throw new Error("typeof text !== 'string'");
  audioTextBuffer.value = text;
  isChangeFlag.value = true;
};

watch(
  // `audioItem` becomes undefined just before the component is unmounted.
  () => audioItem.value?.text,
  (newText) => {
    if (!isChangeFlag.value && newText !== undefined) {
      audioTextBuffer.value = newText;
    }
  }
);

const pushAudioText = async () => {
  if (isChangeFlag.value) {
    isChangeFlag.value = false;
    await store.dispatch("COMMAND_CHANGE_AUDIO_TEXT", {
      audioKey: props.audioKey,
      text: audioTextBuffer.value,
    });
  }
};

let willSelectAll = false;
// NOTE: コンテキストメニューアイテムのonClick実行後も再フォーカスされるため発火する
const setActiveAudioKey = () => {
  if (willSelectAll) {
    willSelectAll = false;
    textfield.value?.select();
  }

  store.dispatch("SET_ACTIVE_AUDIO_KEY", { audioKey: props.audioKey });
};
const isEnableSplitText = computed(() => store.state.splitTextWhenPaste);
// コピペしたときに句点と改行で区切る
const pasteOnAudioCell = async (event: ClipboardEvent) => {
  if (event.clipboardData && isEnableSplitText.value !== "OFF") {
    let texts: string[] = [];
    const clipBoardData = event.clipboardData.getData("text/plain");
    switch (isEnableSplitText.value) {
      case "PERIOD_AND_NEW_LINE":
        texts = clipBoardData.replaceAll("。", "。\n\r").split(/[\n\r]/);
        break;
      case "NEW_LINE":
        texts = clipBoardData.split(/[\n\r]/);
        break;
    }

    if (texts.length > 1) {
      event.preventDefault();
      blurCell(); // フォーカスを外して編集中のテキスト内容を確定させる

      const prevAudioKey = props.audioKey;
      if (audioTextBuffer.value == "") {
        const text = texts.shift();
        if (text == undefined) return;
        setAudioTextBuffer(text);
        await pushAudioText();
      }

      const audioKeys = await store.dispatch("COMMAND_PUT_TEXTS", {
        texts,
        voice: audioItem.value.voice,
        prevAudioKey,
      });
      if (audioKeys)
        emit("focusCell", { audioKey: audioKeys[audioKeys.length - 1] });
    }
  }
};

// 行番号を表示するかどうか
const showTextLineNumber = computed(() => store.state.showTextLineNumber);
// 行番号
const textLineNumberIndex = computed(
  () => audioKeys.value.indexOf(props.audioKey) + 1
);
// 行番号の幅: 2桁はデフォで入るように, 3桁以上は1remずつ広げる
const textLineNumberWidth = computed(() => {
  const indexDigits = String(audioKeys.value.length).length;
  if (indexDigits <= 2) return "1.5rem";
  return `${indexDigits - 0.5}rem`;
});

// 上下に移動
const audioKeys = computed(() => store.state.audioKeys);
const moveUpCell = (e?: KeyboardEvent) => {
  if (e && e.isComposing) return;
  const index = audioKeys.value.indexOf(props.audioKey) - 1;
  if (index >= 0) {
    emit("focusCell", { audioKey: audioKeys.value[index] });
  }
};
const moveDownCell = (e?: KeyboardEvent) => {
  if (e && e.isComposing) return;
  const index = audioKeys.value.indexOf(props.audioKey) + 1;
  if (index < audioKeys.value.length) {
    emit("focusCell", { audioKey: audioKeys.value[index] });
  }
};

// 消去
const willRemove = ref(false);
const removeCell = async () => {
  // 1つだけの時は削除せず
  if (audioKeys.value.length > 1) {
    // フォーカスを外したりREMOVEしたりすると、
    // テキストフィールドのchangeイベントが非同期に飛んでundefinedエラーになる
    // エラー防止のためにまずwillRemoveフラグを建てる
    willRemove.value = true;

    const index = audioKeys.value.indexOf(props.audioKey);
    if (index > 0) {
      emit("focusCell", { audioKey: audioKeys.value[index - 1] });
    } else {
      emit("focusCell", { audioKey: audioKeys.value[index + 1] });
    }

    store.dispatch("COMMAND_REMOVE_AUDIO_ITEM", {
      audioKey: props.audioKey,
    });
  }
};

// 削除ボタンの有効／無効判定
const deleteButtonEnable = computed(() => {
  return 1 < audioKeys.value.length;
});

// テキスト編集エリアの右クリック
// input.valueをスクリプトから変更しない場合は@changeが発火しないため、
// @blurと@keydown.prevent.enter.exactに分けている
const contextMenudata = ref<ContextMenuItemData[]>([
  {
    type: "button",
    label: "切り取り",
    onClick: async () => {
      const text = textfieldSelection.getAsString();
      if (text.length === 0) return;

      const start = textfieldSelection.start;
      setAudioTextBuffer(textfieldSelection.getReplacedStringTo(""));
      await navigator.clipboard.writeText(text);
      // FIXME: <input>への反映までにラグがあるのを、
      //        裏技的に上の行にawaitを追加して、await後に実行することで回避している。
      //        await nextTick()を利用すべきだがなぜか意図したとおりに動かない。
      textfieldSelection.setCursorPosition(start);
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "コピー",
    onClick: () => {
      const text = textfieldSelection.getAsString();
      if (text.length === 0) return;

      navigator.clipboard.writeText(text);
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "貼り付け",
    onClick: async () => {
      // TODO: pasteOnAudioCellを通す
      const text = await navigator.clipboard.readText();
      const beforeLength = textfieldSelection.nativeEl.value.length;
      const end = textfieldSelection.end ?? 0;
      setAudioTextBuffer(textfieldSelection.getReplacedStringTo(text, true));
      await nextTick();
      textfieldSelection.setCursorPosition(
        // 自動的に削除される改行などの文字数を念のため考慮している
        end + textfieldSelection.nativeEl.value.length - beforeLength
      );
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "全選択",
    onClick: async () => {
      // コンテキストメニューを閉じた場合、多分Quasarの内部処理として
      // コンテキストメニューを開いた時点の選択範囲が復元(再選択)される模様。
      // その後に選択範囲を変更しないと反映されないため、フラグを立てて後から処理する。
      willSelectAll = true;
    },
    disableWhenUiLocked: true,
  },
]);
// TODO: (MAY)コンテキストメニューを開いたときに選択範囲が外れる現象の原因調査・修正

const blurCell = (event?: KeyboardEvent) => {
  if (event?.isComposing) {
    return;
  }
  if (document.activeElement instanceof HTMLInputElement) {
    document.activeElement.blur();
  }
};

// フォーカス
const textfield = ref<QInput>();

const textfieldSelection = new QInputSelectionHelper(textfield);

// 複数エンジン
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.audio-cell {
  display: flex;
  padding: 0.4rem 0.5rem;
  margin: 0.2rem 0.5rem;

  &:first-child {
    margin-top: 0.6rem;
  }

  &:last-child {
    margin-bottom: 0.6rem;
  }

  gap: 0px 1rem;

  .active-arrow {
    left: -5px;
    height: 2rem;
  }

  .line-number {
    height: 2rem;
    width: v-bind(textLineNumberWidth);
    line-height: 2rem;
    margin-right: -0.3rem;
    opacity: 0.6;
    text-align: right;
    color: colors.$display;
    &.active {
      opacity: 1;
      font-weight: bold;
      color: colors.$primary-light;
    }
  }

  .q-input {
    :deep(.q-field__control) {
      height: 2rem;
      background: none;
      border-bottom: 1px solid colors.$primary-light;

      &::before {
        border-bottom: none;
      }
    }

    :deep(.q-field__after) {
      height: 2rem;
      padding-left: 5px;
      display: none;
    }

    &.q-field--filled.q-field--highlighted :deep(.q-field__control):before {
      background-color: rgba(colors.$display-rgb, 0.08);
    }
  }

  &:hover > .q-input > :deep(.q-field__after) {
    display: flex;
  }

  :deep(input) {
    caret-color: colors.$display;
    color: colors.$display;
  }
}
</style>
