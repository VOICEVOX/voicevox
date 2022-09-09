<template>
  <div class="audio-cell">
    <q-icon
      v-if="isActiveAudioCell"
      name="arrow_right"
      color="primary-light"
      size="sm"
      class="absolute active-arrow"
    />
    <q-btn
      flat
      class="q-pa-none character-button"
      :disable="uiLocked"
      :class="{ opaque: isInitializingSpeaker }"
    >
      <!-- q-imgだとdisableのタイミングで点滅する -->
      <img class="q-pa-none q-ma-none" :src="selectedStyle.iconPath" />
      <div v-if="isInitializingSpeaker" class="loading">
        <q-spinner color="primary" size="1.6rem" :thickness="7" />
      </div>
      <q-menu
        class="character-menu"
        transition-show="none"
        transition-hide="none"
      >
        <q-list>
          <q-item
            v-for="(characterInfo, characterIndex) in userOrderedCharacterInfos"
            :key="characterIndex"
            class="q-pa-none"
          >
            <q-btn-group flat class="col full-width">
              <q-btn
                flat
                no-caps
                v-close-popup
                class="col-grow"
                :class="
                  characterInfo.metas.speakerUuid ===
                    selectedCharacterInfo.metas.speakerUuid &&
                  'selected-character-item'
                "
                @click="
                  changeStyleId(
                    characterInfo.metas.speakerUuid,
                    getDefaultStyle(characterInfo.metas.speakerUuid).styleId
                  )
                "
                @mouseover="reassignSubMenuOpen(-1)"
                @mouseleave="reassignSubMenuOpen.cancel()"
              >
                <q-avatar rounded size="2rem" class="q-mr-md">
                  <q-img
                    no-spinner
                    no-transition
                    :ratio="1"
                    :src="
                      getDefaultStyle(characterInfo.metas.speakerUuid).iconPath
                    "
                  />
                </q-avatar>
                <div>{{ characterInfo.metas.speakerName }}</div>
              </q-btn>

              <!-- スタイルが2つ以上あるものだけ、スタイル選択ボタンを表示する-->
              <template v-if="characterInfo.metas.styles.length >= 2">
                <q-separator vertical />

                <div
                  class="flex items-center q-px-sm q-py-none cursor-pointer"
                  :class="
                    subMenuOpenFlags[characterIndex] && 'opened-character-item'
                  "
                  @mouseover="reassignSubMenuOpen(characterIndex)"
                  @mouseleave="reassignSubMenuOpen.cancel()"
                >
                  <q-icon
                    name="keyboard_arrow_right"
                    color="grey-6"
                    size="sm"
                  />

                  <q-menu
                    no-parent-event
                    anchor="top end"
                    self="top start"
                    transition-show="none"
                    transition-hide="none"
                    class="character-menu"
                    v-model="subMenuOpenFlags[characterIndex]"
                  >
                    <q-list>
                      <q-item
                        v-for="(style, styleIndex) in characterInfo.metas
                          .styles"
                        :key="styleIndex"
                        clickable
                        v-close-popup
                        active-class="selected-character-item"
                        :active="style.styleId === selectedStyle.styleId"
                        @click="
                          changeStyleId(
                            characterInfo.metas.speakerUuid,
                            style.styleId
                          )
                        "
                      >
                        <q-avatar rounded size="2rem" class="q-mr-md">
                          <q-img
                            no-spinner
                            no-transition
                            :ratio="1"
                            :src="
                              characterInfo.metas.styles[styleIndex].iconPath
                            "
                          />
                        </q-avatar>
                        <q-item-section v-if="style.styleName"
                          >{{ characterInfo.metas.speakerName }} ({{
                            style.styleName
                          }})</q-item-section
                        >
                        <q-item-section v-else>{{
                          characterInfo.metas.speakerName
                        }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </div>
              </template>
            </q-btn-group>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
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
import { QInput, debounce } from "quasar";

export default defineComponent({
  name: "AudioCell",

  props: {
    audioKey: { type: String, required: true },
  },

  emits: ["focusCell"],

  setup(props, { emit }) {
    const store = useStore();
    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );
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

    const selectedCharacterInfo = computed(() =>
      userOrderedCharacterInfos.value !== undefined &&
      audioItem.value.engineId !== undefined &&
      audioItem.value.styleId !== undefined
        ? store.getters.CHARACTER_INFO(
            audioItem.value.engineId,
            audioItem.value.styleId
          )
        : undefined
    );
    const selectedStyle = computed(() =>
      selectedCharacterInfo.value?.metas.styles.find(
        (style) => style.styleId === audioItem.value.styleId
      )
    );

    const subMenuOpenFlags = ref(
      [...Array(userOrderedCharacterInfos.value?.length)].map(() => false)
    );

    const reassignSubMenuOpen = debounce((idx: number) => {
      if (subMenuOpenFlags.value[idx]) return;
      const arr = [...Array(userOrderedCharacterInfos.value?.length)].map(
        () => false
      );
      arr[idx] = true;
      subMenuOpenFlags.value = arr;
    }, 100);

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

    const changeStyleId = (speakerUuid: string, styleId: number) => {
      // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
      const engineId = store.state.engineIds.find((_engineId) =>
        (store.state.characterInfos[_engineId] ?? []).some(
          (characterInfo) => characterInfo.metas.speakerUuid === speakerUuid
        )
      );
      if (engineId === undefined)
        throw new Error(
          `No engineId for target character style (speakerUuid == ${speakerUuid}, styleId == ${styleId})`
        );

      store.dispatch("COMMAND_CHANGE_STYLE_ID", {
        audioKey: props.audioKey,
        engineId,
        styleId,
      });
    };
    const getDefaultStyle = (speakerUuid: string) => {
      // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
      const characterInfo = userOrderedCharacterInfos.value?.find(
        (info) => info.metas.speakerUuid === speakerUuid
      );
      const defaultStyleId = store.state.defaultStyleIds.find(
        (x) => x.speakerUuid === speakerUuid
      )?.defaultStyleId;

      return characterInfo?.metas.styles.find(
        (style) => style.styleId === defaultStyleId
      );
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

          const styleId = audioItem.value.styleId;
          if (styleId === undefined)
            throw new Error("assert styleId !== undefined");

          const audioKeys = await store.dispatch("COMMAND_PUT_TEXTS", {
            texts,
            engineId,
            styleId,
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
    const moveUpCell = () => {
      const index = audioKeys.value.indexOf(props.audioKey) - 1;
      if (index >= 0) {
        emit("focusCell", { audioKey: audioKeys.value[index] });
      }
    };
    const moveDownCell = () => {
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

    return {
      userOrderedCharacterInfos,
      isInitializingSpeaker,
      audioItem,
      deleteButtonEnable,
      uiLocked,
      nowPlaying,
      nowGenerating,
      selectedCharacterInfo,
      selectedStyle,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      isActiveAudioCell,
      audioTextBuffer,
      setAudioTextBuffer,
      pushAudioText,
      changeStyleId,
      getDefaultStyle,
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
  .character-button {
    border: solid 1px;
    border-color: colors.$primary-light;
    font-size: 0;
    height: fit-content;
    img {
      width: 2rem;
      height: 2rem;
      object-fit: scale-down;
    }
    .loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: auto;
      background-color: rgba(colors.$background-rgb, 0.74);
      display: grid;
      justify-content: center;
      align-content: center;
      svg {
        filter: drop-shadow(0 0 1px colors.$background);
      }
    }
  }
  .opaque {
    opacity: 1 !important;
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

.character-menu {
  .q-item {
    color: colors.$display;
  }
  .q-btn-group {
    > .q-btn:first-child > :deep(.q-btn__content) {
      justify-content: flex-start;
    }
    > div:last-child:hover {
      background-color: rgba(colors.$primary-rgb, 0.1);
    }
  }
  .selected-character-item,
  .opened-character-item {
    background-color: rgba(colors.$primary-rgb, 0.2);
  }
}
</style>
