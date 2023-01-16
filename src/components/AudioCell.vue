<template>
  <div class="audio-cell">
    <q-icon
      v-if="isActiveAudioCell"
      name="arrow_right"
      color="primary-light"
      size="sm"
      class="absolute active-arrow"
    />
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
      @change="willRemove || pushAudioText()"
      @paste="pasteOnAudioCell"
      @focus="setActiveAudioKey()"
      @keydown.prevent.up.exact="moveUpCell"
      @keydown.prevent.down.exact="moveDownCell"
      @mouseup.right="onRightClickTextField"
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
        />
      </template>
    </q-input>
  </div>
</template>

<script lang="ts">
import { computed, watch, defineComponent, ref } from "vue";
import { useStore } from "@/store";
import { AudioItem } from "@/store/type";
import { Voice } from "@/type/preload";
import { QInput } from "quasar";
import CharacterButton from "./CharacterButton.vue";

export default defineComponent({
  name: "AudioCell",

  components: { CharacterButton },

  props: {
    audioKey: { type: String, required: true },
  },

  emits: ["focusCell"],

  setup(props, { emit }) {
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
    const nowPlaying = computed(
      () => store.state.audioStates[props.audioKey].nowPlaying
    );
    const nowGenerating = computed(
      () => store.state.audioStates[props.audioKey].nowGenerating
    );

    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const selectedVoice = computed<Voice | undefined>({
      get() {
        const engineId = audioItem.value.engineId;
        const styleId = audioItem.value.styleId;

        if (
          engineId == undefined ||
          styleId == undefined ||
          !store.state.engineIds.some(
            (storeEngineId) => storeEngineId === engineId
          )
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
    const setAudioTextBuffer = (text: string) => {
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

    const setActiveAudioKey = () => {
      store.dispatch("SET_ACTIVE_AUDIO_KEY", { audioKey: props.audioKey });
    };
    const save = () => {
      store.dispatch("GENERATE_AND_SAVE_AUDIO", { audioKey: props.audioKey });
    };

    const play = () => {
      store.dispatch("PLAY_AUDIO", { audioKey: props.audioKey });
    };

    const stop = () => {
      store.dispatch("STOP_AUDIO", { audioKey: props.audioKey });
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

          const engineId = audioItem.value.engineId;
          if (engineId === undefined)
            throw new Error("assert engineId !== undefined");

          const speakerId = audioItem.value.speakerId;
          if (speakerId === undefined)
            throw new Error("assert speakerId !== undefined");

          const styleId = audioItem.value.styleId;
          if (styleId === undefined)
            throw new Error("assert styleId !== undefined");

          const audioKeys = await store.dispatch("COMMAND_PUT_TEXTS", {
            texts,
            voice: {
              engineId,
              speakerId,
              styleId,
            },
            prevAudioKey,
          });
          if (audioKeys)
            emit("focusCell", { audioKey: audioKeys[audioKeys.length - 1] });
        }
      }
    };

    // 選択されている
    const isActive = computed(() => store.getters.IS_ACTIVE(props.audioKey));

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
    const onRightClickTextField = () => {
      store.dispatch("OPEN_TEXT_EDIT_CONTEXT_MENU");
    };

    // 下にセルを追加
    const addCellBellow = async () => {
      const styleId = store.state.audioItems[props.audioKey].styleId;
      const audioItem: AudioItem = { text: "", styleId };
      await store.dispatch("COMMAND_REGISTER_AUDIO_ITEM", {
        audioItem,
        prevAudioKey: props.audioKey,
      });
      moveDownCell();
    };

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
    const focusTextField = () => {
      if (textfield.value == undefined) return;
      textfield.value.focus();
    };

    // 複数エンジン
    const isMultipleEngine = computed(() => store.state.engineIds.length > 1);

    return {
      userOrderedCharacterInfos,
      isInitializingSpeaker,
      audioItem,
      deleteButtonEnable,
      uiLocked,
      nowPlaying,
      nowGenerating,
      selectedVoice,
      isActiveAudioCell,
      audioTextBuffer,
      isMultipleEngine,
      setAudioTextBuffer,
      pushAudioText,
      setActiveAudioKey,
      save,
      play,
      stop,
      willRemove,
      removeCell,
      addCellBellow,
      isActive,
      moveUpCell,
      moveDownCell,
      pasteOnAudioCell,
      onRightClickTextField,
      textfield,
      focusTextField,
      blurCell,
    };
  },
});
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
