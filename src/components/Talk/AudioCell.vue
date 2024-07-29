<template>
  <div
    ref="root"
    class="audio-cell"
    tabindex="-1"
    :class="{
      active: isActiveAudioCell,
      // selectedクラスはテストで使われているので残す。
      // TODO: テストをこのクラスに依存しないようにして、このクラスを消す。
      selected: isSelectedAudioCell && isMultiSelectEnabled,
      'selected-highlight':
        isSelectedAudioCell &&
        isMultiSelectEnabled &&
        selectedAudioKeys.length > 1,
    }"
    @keydown.prevent.up="moveUpCell"
    @keydown.prevent.down="moveDownCell"
    @focus="onRootFocus"
    @click.stop=""
  >
    <!-- 複数選択用のヒットボックス -->
    <!-- テキスト欄の範囲選択との競合を防ぐため、activeの時はCtrlでしか出現しないようにする。 -->
    <div
      v-if="
        isMultiSelectEnabled && isActiveAudioCell
          ? isCtrlOrCommandKeyDown
          : isCtrlOrCommandKeyDown || isShiftKeyDown
      "
      class="click-hitbox"
      tabindex="-1"
      @click="onClickWithModifierKey"
    />
    <QIcon
      v-if="isActiveAudioCell"
      name="arrow_right"
      color="primary"
      size="sm"
      class="absolute active-arrow"
    />
    <div
      v-if="showTextLineNumber"
      class="line-number"
      :class="{ active: isActiveAudioCell }"
    >
      {{ textLineNumberIndex }}
    </div>
    <CharacterButton
      v-model:selected-voice="selectedVoice"
      :characterInfos="userOrderedCharacterInfos"
      :loading="isInitializingSpeaker"
      :showEngineInfo="isMultipleEngine"
      :uiLocked
      @focus="
        if (!isSelectedAudioCell) {
          selectAndSetActiveAudioKey();
        }
      "
    />
    <!--
      input.valueをスクリプトから変更した場合は@changeが発火しないため、
      @blurと@keydown.prevent.enter.exactに分けている
    -->
    <QInput
      ref="textField"
      filled
      dense
      hideBottomSpace
      class="full-width"
      color="primary"
      :disable="uiLocked"
      :error="audioTextBuffer.length >= 80"
      :modelValue="audioTextBuffer"
      :aria-label="`${textLineNumberIndex}行目`"
      @update:modelValue="setAudioTextBuffer"
      @focus="
        clearInputSelection();
        selectAndSetActiveAudioKey();
      "
      @blur="pushAudioTextIfNeeded()"
      @paste="pasteOnAudioCell"
      @keydown.prevent.enter.exact="pushAudioTextIfNeeded"
    >
      <template #error>
        文章が長いと正常に動作しない可能性があります。
        句読点の位置で文章を分割してください。
      </template>
      <template v-if="enableDeleteButton" #after>
        <QBtn
          round
          flat
          icon="delete_outline"
          size="0.8rem"
          :disable="uiLocked"
          :aria-label="`${textLineNumberIndex}行目を削除`"
          @click="removeCell"
        />
      </template>
      <ContextMenu
        ref="contextMenu"
        :header="contextMenuHeader"
        :menudata="contextMenudata"
        @beforeShow="
          startContextMenuOperation();
          readyForContextMenu();
        "
        @beforeHide="endContextMenuOperation()"
      />
    </QInput>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from "vue";
import { QInput } from "quasar";
import CharacterButton from "@/components/CharacterButton.vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/Menu/type";
import ContextMenu from "@/components/Menu/ContextMenu.vue";
import { useStore } from "@/store";
import { AudioKey, SplitTextWhenPasteType, Voice } from "@/type/preload";
import { SelectionHelperForQInput } from "@/helpers/SelectionHelperForQInput";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import {
  useShiftKey,
  useCommandOrControlKey,
} from "@/composables/useModifierKey";
import { getDefaultStyle } from "@/domain/talk";

const props = defineProps<{
  audioKey: AudioKey;
}>();

const emit = defineEmits<{
  // focusTarget：
  //   textField: テキストフィールドにフォーカス。複数選択が解除される。特別な理由がない限りはこちらを使う。
  //   root: AudioCell自体にフォーカス。こちらは複数選択を解除しない。
  (
    e: "focusCell",
    payload: { audioKey: AudioKey; focusTarget?: "textField" | "root" },
  ): void;
}>();

defineExpose({
  audioKey: computed(() => props.audioKey),
  focusCell: ({
    focusTarget: baseFocusTarget,
  }: {
    focusTarget?: "textField" | "root";
  }) => {
    const focusTarget = baseFocusTarget ?? "textField";
    if (focusTarget === "textField") {
      textField.value?.focus();
    } else {
      root.value?.focus();
    }
  },
  removeCell: () => {
    removeCell();
  },
  /** index番目のキャラクターを選ぶ */
  selectCharacterAt: (index: number) => {
    selectCharacterAt(index);
  },
});

const store = useStore();
const userOrderedCharacterInfos = computed(() => {
  const infos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (infos == undefined)
    throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");
  return infos;
});
const isInitializingSpeaker = computed(() =>
  store.state.audioKeysWithInitializingSpeaker.includes(props.audioKey),
);
const audioItem = computed(() => store.state.audioItems[props.audioKey]);

const uiLocked = computed(() => store.getters.UI_LOCKED);

const isMultiSelectEnabled = computed(
  () => store.state.experimentalSetting.enableMultiSelect,
);

const selectAndSetActiveAudioKey = () => {
  store.dispatch("SET_ACTIVE_AUDIO_KEY", { audioKey: props.audioKey });
  store.dispatch("SET_SELECTED_AUDIO_KEYS", { audioKeys: [props.audioKey] });
};

const onRootFocus = () => {
  if (uiLocked.value) return;

  selectAndSetActiveAudioKey();
};

const isShiftKeyDown = useShiftKey();
const isCtrlOrCommandKeyDown = useCommandOrControlKey();

// 複数選択：Ctrl（Cmd）またはShiftキーが押されている時のクリック処理
const onClickWithModifierKey = (event: MouseEvent) => {
  if (uiLocked.value) return;
  const currentActiveAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  const currentSelectedAudioKeys = store.getters.SELECTED_AUDIO_KEYS;
  let newActiveAudioKey: AudioKey | undefined = currentActiveAudioKey;
  let newSelectedAudioKeys: AudioKey[] = [...currentSelectedAudioKeys];
  if (event.shiftKey) {
    if (currentActiveAudioKey) {
      const currentAudioIndex = store.state.audioKeys.indexOf(
        currentActiveAudioKey,
      );
      const clickedAudioIndex = store.state.audioKeys.indexOf(props.audioKey);
      const minIndex = Math.min(currentAudioIndex, clickedAudioIndex);
      const maxIndex = Math.max(currentAudioIndex, clickedAudioIndex);
      const audioKeysBetween = store.state.audioKeys.slice(
        minIndex,
        maxIndex + 1,
      );
      newActiveAudioKey = props.audioKey;
      newSelectedAudioKeys = [...currentSelectedAudioKeys, ...audioKeysBetween];
    }
  } else if (isOnCommandOrCtrlKeyDown(event)) {
    // Ctrlキーを押しながらクリックしたとき：
    //   activeなAudioCellなら：
    //     selectedが複数ある場合はactiveを次のselectedに移動し、selectedから除外する。
    //     selectedが1つの場合はなにもしない。
    //   選択していないAudioCellならactiveを移動し、以前の選択をselectedに追加する。
    //   選択しているAudioCellならselectedから除外する。activeは変更しない。
    if (props.audioKey === currentActiveAudioKey) {
      if (currentSelectedAudioKeys.length > 1) {
        const currentAudioIndex = currentSelectedAudioKeys.indexOf(
          currentActiveAudioKey,
        );
        newActiveAudioKey =
          currentSelectedAudioKeys[
            (currentAudioIndex + 1) % currentSelectedAudioKeys.length
          ];
        newSelectedAudioKeys = currentSelectedAudioKeys.filter(
          (audioKey) => audioKey !== props.audioKey,
        );
      }
    } else if (currentSelectedAudioKeys.includes(props.audioKey)) {
      newActiveAudioKey = currentActiveAudioKey;
      newSelectedAudioKeys = currentSelectedAudioKeys.filter(
        (audioKey) => audioKey !== props.audioKey,
      );
    } else {
      newActiveAudioKey = props.audioKey;
      newSelectedAudioKeys = [...currentSelectedAudioKeys, props.audioKey];
    }
  }
  store.dispatch("SET_ACTIVE_AUDIO_KEY", { audioKey: newActiveAudioKey });
  store.dispatch("SET_SELECTED_AUDIO_KEYS", {
    audioKeys: newSelectedAudioKeys,
  });
};

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
    store.dispatch("COMMAND_MULTI_CHANGE_VOICE", {
      audioKeys: isMultiSelectEnabled.value
        ? store.getters.SELECTED_AUDIO_KEYS
        : [props.audioKey],
      voice,
    });
  },
});

const isActiveAudioCell = computed(
  () => props.audioKey === store.getters.ACTIVE_AUDIO_KEY,
);
const selectedAudioKeys = computed(() => store.getters.SELECTED_AUDIO_KEYS);
const isSelectedAudioCell = computed(() =>
  selectedAudioKeys.value.includes(props.audioKey),
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
    if (!isChangeFlag.value && newText != undefined) {
      audioTextBuffer.value = newText;
    }
  },
);

const pushAudioTextIfNeeded = async (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  if (!willRemove.value && isChangeFlag.value && !willFocusOrBlur.value) {
    isChangeFlag.value = false;
    await store.dispatch("COMMAND_CHANGE_AUDIO_TEXT", {
      audioKey: props.audioKey,
      text: audioTextBuffer.value,
    });
  }
};

// バグ修正用
// see https://github.com/VOICEVOX/voicevox/pull/1364#issuecomment-1620594931
const clearInputSelection = () => {
  if (!willFocusOrBlur.value) {
    textFieldSelection.toEmpty();
  }
};

// コピペしたときに句点と改行で区切る
const textSplitType = computed(() => store.state.splitTextWhenPaste);
const pasteOnAudioCell = async (event: ClipboardEvent) => {
  event.preventDefault();
  paste({ text: event.clipboardData?.getData("text/plain") });
};
/**
 * 貼り付け。
 * ブラウザ版を考えるとClipboard APIをなるべく回避したいため、積極的に`options.text`を指定してください。
 */
const paste = async (options?: { text?: string }) => {
  const text = options ? options.text : await navigator.clipboard.readText();
  if (text == undefined) return;

  // 複数行貼り付けできるか試す
  if (textSplitType.value !== "OFF") {
    const textSplitter: Record<
      SplitTextWhenPasteType,
      (text: string) => string[]
    > = {
      PERIOD_AND_NEW_LINE: (text) =>
        text.replaceAll("。", "。\r\n").split(/[\r\n]/),
      NEW_LINE: (text) => text.split(/[\r\n]/),
      OFF: (text) => [text],
    };
    const texts = textSplitter[textSplitType.value](text);

    if (texts.length >= 2 && texts.some((text) => text !== "")) {
      await putMultilineText(texts);
      return;
    }
  }

  const beforeLength = audioTextBuffer.value.length;
  const end = textFieldSelection.selectionEnd ?? 0;
  setAudioTextBuffer(textFieldSelection.getReplacedStringTo(text));
  await nextTick();
  // 自動的に削除される改行などの文字数を念のため考慮している
  textFieldSelection.setCursorPosition(
    end + audioTextBuffer.value.length - beforeLength,
  );
};
const putMultilineText = async (texts: string[]) => {
  // フォーカスを外して編集中のテキスト内容を確定させる
  if (document.activeElement instanceof HTMLInputElement) {
    document.activeElement.blur();
  }

  const prevAudioKey = props.audioKey;
  if (audioTextBuffer.value == "") {
    const text = texts.shift();
    if (text == undefined) throw new Error("予期せぬタイプエラーです。");
    setAudioTextBuffer(text);
    await pushAudioTextIfNeeded();
  }

  const audioKeys = await store.dispatch("COMMAND_PUT_TEXTS", {
    texts,
    voice: audioItem.value.voice,
    prevAudioKey,
  });
  if (audioKeys.length > 0) {
    emit("focusCell", {
      audioKey: audioKeys[audioKeys.length - 1],
    });
  }
};

// 行番号を表示するかどうか
const showTextLineNumber = computed(() => store.state.showTextLineNumber);
// 行番号
const textLineNumberIndex = computed(
  () => audioKeys.value.indexOf(props.audioKey) + 1,
);
// 行番号の幅: 2桁はデフォで入るように, 3桁以上は1remずつ広げる
const textLineNumberWidth = computed(() => {
  const indexDigits = String(audioKeys.value.length).length;
  if (indexDigits <= 2) return "1.5rem";
  return `${indexDigits - 0.5}rem`;
});

// 上下に移動
const audioKeys = computed(() => store.state.audioKeys);
const moveCell = (offset: number) => (e?: KeyboardEvent) => {
  if (e && e.isComposing) return;
  const index = audioKeys.value.indexOf(props.audioKey) + offset;
  if (index >= 0 && index < audioKeys.value.length) {
    if (isMultiSelectEnabled.value && e?.shiftKey) {
      // focusCellをemitする前にselectedAudioKeysを保存しておく。
      // （focusCellでselectedAudioKeysが変更されるため）
      const selectedAudioKeysBefore = selectedAudioKeys.value;
      emit("focusCell", {
        audioKey: audioKeys.value[index],
        focusTarget: "root",
      });
      store.dispatch("SET_SELECTED_AUDIO_KEYS", {
        audioKeys: [
          ...selectedAudioKeysBefore,
          props.audioKey,
          audioKeys.value[index],
        ],
      });
    } else {
      emit("focusCell", {
        audioKey: audioKeys.value[index],
        focusTarget: "textField",
      });
    }
  }
};
const moveUpCell = moveCell(-1);
const moveDownCell = moveCell(1);

// 消去
const willRemove = ref(false);
const removeCell = async () => {
  let audioKeysToDelete: AudioKey[];
  if (
    isMultiSelectEnabled.value &&
    store.getters.SELECTED_AUDIO_KEYS.includes(props.audioKey)
  ) {
    audioKeysToDelete = store.getters.SELECTED_AUDIO_KEYS;
  } else {
    audioKeysToDelete = [props.audioKey];
  }
  // 全て消える場合はなにもしない
  if (audioKeys.value.length > audioKeysToDelete.length) {
    // フォーカスを外したりREMOVEしたりすると、
    // テキストフィールドのchangeイベントが非同期に飛んでundefinedエラーになる
    // エラー防止のためにまずwillRemoveフラグを建てる
    willRemove.value = true;

    if (audioKeysToDelete.includes(props.audioKey)) {
      // 選択するAudioKeyを決定する。
      // - 削除ボタンが押されたAudioCellから開始
      // - 残るAudioCellを上方向に探す
      // - 上方向になかったら下方向に探す
      // - なかったらエラー（Unreachable）
      const startIndex = audioKeys.value.indexOf(props.audioKey);
      let willNextFocusIndex = -1;
      for (let i = startIndex; i >= 0; i--) {
        if (!audioKeysToDelete.includes(audioKeys.value[i])) {
          willNextFocusIndex = i;
          break;
        }
      }
      if (willNextFocusIndex === -1) {
        for (let i = startIndex; i < audioKeys.value.length; i++) {
          if (!audioKeysToDelete.includes(audioKeys.value[i])) {
            willNextFocusIndex = i;
            break;
          }
        }
      }
      if (willNextFocusIndex === -1) {
        throw new Error(
          "次に選択するaudioKeyが見付かりませんでした（unreachable）",
        );
      }
      emit("focusCell", {
        audioKey: audioKeys.value[willNextFocusIndex],
      });
    }

    store.dispatch("COMMAND_MULTI_REMOVE_AUDIO_ITEM", {
      audioKeys: audioKeysToDelete,
    });
  }
};

// N番目のキャラクターを選ぶ
const selectCharacterAt = (index: number) => {
  if (userOrderedCharacterInfos.value.length < index + 1) {
    return;
  }
  const speakerUuid = userOrderedCharacterInfos.value[index].metas.speakerUuid;
  const style = getDefaultStyle(
    speakerUuid,
    userOrderedCharacterInfos.value,
    store.state.defaultStyleIds,
  );
  const voice = {
    engineId: style.engineId,
    speakerId: speakerUuid,
    styleId: style.styleId,
  };
  store.dispatch("COMMAND_MULTI_CHANGE_VOICE", {
    audioKeys: isMultiSelectEnabled.value
      ? store.getters.SELECTED_AUDIO_KEYS
      : [props.audioKey],
    voice,
  });
};

// 削除ボタンの有効／無効判定
const enableDeleteButton = computed(() => {
  return (
    store.state.audioKeys.length >
    (isMultiSelectEnabled.value ? store.getters.SELECTED_AUDIO_KEYS.length : 1)
  );
});

// テキスト編集エリアの右クリック
const contextMenu = ref<InstanceType<typeof ContextMenu>>();

// FIXME: 可能なら`isRangeSelected`と`contextMenuHeader`をcomputedに
const isRangeSelected = ref(false);
const contextMenuHeader = ref<string | undefined>("");
const contextMenudata = ref<
  [
    MenuItemButton,
    MenuItemButton,
    MenuItemButton,
    MenuItemSeparator,
    MenuItemButton,
    MenuItemSeparator,
    MenuItemButton,
  ]
>([
  // NOTE: audioTextBuffer.value の変更が nativeEl.value に反映されるのはnextTick。
  {
    type: "button",
    label: "切り取り",
    onClick: async () => {
      contextMenu.value?.hide();
      if (textFieldSelection.isEmpty) return;

      const text = textFieldSelection.getAsString();
      const start = textFieldSelection.selectionStart;
      setAudioTextBuffer(textFieldSelection.getReplacedStringTo(""));
      await nextTick();
      navigator.clipboard.writeText(text);
      textFieldSelection.setCursorPosition(start);
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "コピー",
    onClick: () => {
      contextMenu.value?.hide();
      if (textFieldSelection.isEmpty) return;

      navigator.clipboard.writeText(textFieldSelection.getAsString());
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "貼り付け",
    onClick: async () => {
      contextMenu.value?.hide();
      paste();
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "全選択",
    onClick: async () => {
      contextMenu.value?.hide();
      textField.value?.select();
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "読みを変えずに適用",
    onClick: async () => {
      contextMenu.value?.hide();
      isChangeFlag.value = false;
      await store.dispatch("COMMAND_CHANGE_DISPLAY_TEXT", {
        audioKey: props.audioKey,
        text: audioTextBuffer.value,
      });
      textField.value?.blur();
    },
    disableWhenUiLocked: true,
  },
]);
/**
 * コンテキストメニューの開閉によりFocusやBlurが発生する可能性のある間は`true`。
 */
// no-focus を付けた場合と付けてない場合でタイミングが異なるため、両方に対応。
const willFocusOrBlur = ref(false);
const startContextMenuOperation = () => {
  willFocusOrBlur.value = true;
};
const readyForContextMenu = () => {
  const getMenuItemButton = (label: string) => {
    const item = contextMenudata.value.find((item) => item.label === label);
    if (item?.type !== "button")
      throw new Error("コンテキストメニューアイテムの取得に失敗しました。");
    return item;
  };

  const MAX_HEADER_LENGTH = 15;
  const SHORTED_HEADER_FRAGMENT_LENGTH = 5;

  // 選択範囲を1行目に表示
  const selectionText = textFieldSelection.getAsString();
  if (selectionText.length === 0) {
    isRangeSelected.value = false;
    getMenuItemButton("切り取り").disabled = true;
    getMenuItemButton("コピー").disabled = true;
  } else {
    isRangeSelected.value = true;
    getMenuItemButton("切り取り").disabled = false;
    getMenuItemButton("コピー").disabled = false;
    if (selectionText.length > MAX_HEADER_LENGTH) {
      // 長すぎる場合適度な長さで省略
      contextMenuHeader.value =
        selectionText.length <= MAX_HEADER_LENGTH
          ? selectionText
          : `${selectionText.substring(
              0,
              SHORTED_HEADER_FRAGMENT_LENGTH,
            )} ... ${selectionText.substring(
              selectionText.length - SHORTED_HEADER_FRAGMENT_LENGTH,
            )}`;
    } else {
      contextMenuHeader.value = selectionText;
    }
  }
};
const endContextMenuOperation = async () => {
  await nextTick();
  willFocusOrBlur.value = false;
};

const root = ref<HTMLElement>();

// テキスト欄
const textField = ref<QInput>();
const textFieldSelection = new SelectionHelperForQInput(textField);

// 複数エンジン
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
</script>

<style scoped lang="scss">
@use "@/styles/visually-hidden" as visually-hidden;
@use "@/styles/colors" as colors;

.audio-cell {
  display: flex;
  position: relative;
  padding: 0.4rem 0.5rem;
  margin: 0.2rem 0.5rem;
  &:focus {
    // divはフォーカスするとデフォルトで青い枠が出るので消す
    outline: none;
  }
  &.selected-highlight {
    background-color: colors.$active-point-focus;
  }

  &:first-child {
    margin-top: 0.6rem;
  }

  &:last-child {
    margin-bottom: 0.6rem;
  }

  gap: 0px 1rem;

  .active-arrow {
    left: -1rem;
    height: 2rem;
  }

  .line-number {
    height: 2rem;
    width: v-bind(textLineNumberWidth);
    line-height: 2rem;
    margin-left: -0.1rem;
    margin-right: -0.4rem;
    opacity: 0.6;
    text-align: right;
    color: colors.$display;
    &.active {
      opacity: 1;
      font-weight: bold;
      color: colors.$primary;
    }
  }

  .q-input {
    :deep(.q-field__control) {
      height: 2rem;
      background: none;
      border-bottom: 1px solid colors.$primary;

      &::before {
        border-bottom: none;
      }
    }

    :deep(.q-field__after) {
      height: 2rem;
      padding-left: 5px;
    }

    &.q-field--filled.q-field--highlighted :deep(.q-field__control)::before {
      background-color: rgba(colors.$display-rgb, 0.08);
    }
  }

  &:not(:hover) > .q-input > .q-field__after > .q-btn:not(:focus):not(:active) {
    @include visually-hidden.visually-hidden;
  }

  :deep(input) {
    caret-color: colors.$display;
    color: colors.$display;
  }
}

.click-hitbox {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: none;
  z-index: 1;
  cursor: default;
}
</style>
