<template>
  <div class="audio-cell">
    <q-icon
      v-if="isActiveAudioCell"
      name="arrow_right"
      color="primary"
      size="sm"
      class="absolute active-arrow"
    />
    <q-btn flat class="q-pa-none character-button" :disable="uiLocked">
      <!-- q-imgだとdisableのタイミングで点滅する -->
      <img class="q-pa-none q-ma-none" :src="characterIconUrl" />
      <q-menu
        class="character-menu"
        transition-show="none"
        transition-hide="none"
      >
        <q-list>
          <q-item
            v-for="(characterInfo, index) in characterInfos"
            :key="index"
            clickable
            v-close-popup
            active-class="selected-character-item"
            :active="
              characterInfo.metas.speakerUuid ===
              selectedCharacterInfo.metas.speakerUuid
            "
            @click="changeStyleId(characterInfo.metas.defaultStyleId)"
            @mouseover="reassignSubMenuOpen(index)"
            @mouseleave="reassignSubMenuOpen.cancel()"
          >
            <q-item-section avatar>
              <q-avatar rounded size="2rem">
                <q-img
                  no-spinner
                  no-transition
                  :ratio="1"
                  :src="getCharacterIconUrl(characterInfo)"
                />
              </q-avatar>
            </q-item-section>
            <q-item-section>{{
              characterInfo.metas.speakerName
            }}</q-item-section>
            <q-item-section side>
              <q-icon name="keyboard_arrow_right" />
            </q-item-section>

            <q-menu
              anchor="top end"
              self="top start"
              transition-show="none"
              transition-hide="none"
              class="character-menu"
              v-model="subMenuOpenFlags[index]"
            >
              <q-list>
                <q-item
                  v-for="(style, index) in characterInfo.metas.styles"
                  :key="index"
                  clickable
                  v-close-popup
                  active-class="selected-character-item"
                  :active="style.styleId === selectedStyleId"
                  @click="changeStyleId(style.styleId)"
                >
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
      :disable="uiLocked"
      :error="audioTextBuffer.length >= 80"
      :model-value="audioTextBuffer"
      @update:model-value="setAudioTextBuffer"
      @change="willRemove || pushAudioText($event)"
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
import { computed, watch, defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { AudioItem } from "@/store/type";
import { CharacterInfo } from "@/type/preload";
import { QInput, debounce } from "quasar";

export default defineComponent({
  name: "AudioCell",

  props: {
    audioKey: { type: String, required: true },
  },

  emits: ["focusCell"],

  setup(props, { emit }) {
    const store = useStore();
    const characterInfos = computed(() => store.state.characterInfos);
    const audioItem = computed(() => store.state.audioItems[props.audioKey]);
    const nowPlaying = computed(
      () => store.state.audioStates[props.audioKey].nowPlaying
    );
    const nowGenerating = computed(
      () => store.state.audioStates[props.audioKey].nowGenerating
    );

    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const selectedCharacterInfo = computed(() =>
      store.state.characterInfos !== undefined &&
      audioItem.value.styleId !== undefined
        ? store.state.characterInfos.find((info) =>
            info.metas.styles.find(
              (style) => style.styleId === audioItem.value.styleId
            )
          )
        : undefined
    );
    const selectedStyleId = computed(() => audioItem.value.styleId);

    const characterIconUrl = computed(() =>
      URL.createObjectURL(selectedCharacterInfo.value?.iconBlob)
    );

    const subMenuOpenFlags = ref(
      [...Array(characterInfos.value?.length)].map(() => false)
    );

    const reassignSubMenuOpen = debounce((idx: number) => {
      if (subMenuOpenFlags.value[idx]) return;
      const arr = [...Array(characterInfos.value?.length)].map(() => false);
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

    const pushAudioText = async (text: string) => {
      if (isChangeFlag.value) {
        isChangeFlag.value = false;
        await store.dispatch("COMMAND_CHANGE_AUDIO_TEXT", {
          audioKey: props.audioKey,
          text: audioTextBuffer.value,
        });
      }
    };

    const changeStyleId = (styleId: number) => {
      store.dispatch("COMMAND_CHANGE_STYLE_ID", {
        audioKey: props.audioKey,
        styleId,
      });
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

    // コピペしたときに句点と改行で区切る
    const pasteOnAudioCell = async (event: ClipboardEvent) => {
      if (event.clipboardData) {
        const texts = event.clipboardData
          .getData("text/plain")
          .replaceAll("。", "。\n\r")
          .split(/[\n\r]/);

        if (texts.length > 1) {
          event.preventDefault();
          blurCell(); // フォーカスを外して編集中のテキスト内容を確定させる

          const prevAudioKey = props.audioKey;
          if (audioTextBuffer.value == "") {
            const text = texts.shift();
            if (text == undefined) return;
            setAudioTextBuffer(text);
            await pushAudioText(text);
          }

          const audioKeys = await store.dispatch("COMMAND_PUT_TEXTS", {
            texts,
            styleId: audioItem.value.styleId!,
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

    // キャラクター選択
    const isOpenedCharacterList = ref(false);

    const getCharacterIconUrl = computed(
      () => (characterInfo: CharacterInfo) =>
        URL.createObjectURL(characterInfo.iconBlob)
    );

    // 初期化
    onMounted(() => {
      // TODO: hotfix用のコード https://github.com/Hiroshiba/voicevox/issues/139
      if (audioItem.value.query == undefined) {
        store.dispatch("FETCH_AND_SET_AUDIO_QUERY", {
          audioKey: props.audioKey,
        });
      }
    });

    return {
      characterInfos,
      audioItem,
      deleteButtonEnable,
      uiLocked,
      nowPlaying,
      nowGenerating,
      selectedCharacterInfo,
      selectedStyleId,
      characterIconUrl,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      isActiveAudioCell,
      audioTextBuffer,
      setAudioTextBuffer,
      pushAudioText,
      changeStyleId,
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
      isOpenedCharacterList,
      getCharacterIconUrl,
    };
  },
});
</script>

<style lang="scss">
@use '@/styles' as global;

.audio-cell {
  display: flex;
  margin: 1rem 1rem;
  gap: 0px 1rem;
  .active-arrow {
    left: -5px;
    height: 2rem;
  }
  .character-button {
    border: solid 1px;
    border-color: global.$primary;
    font-size: 0;
    height: fit-content;
    img {
      width: 2rem;
      height: 2rem;
      object-fit: scale-down;
    }
  }
  .q-input {
    .q-field__control {
      height: 2rem;
      background: none;
      border-bottom: 1px solid global.$primary;
      &::before {
        border-bottom: none;
      }
    }
    .q-field__after {
      height: 2rem;
      padding-left: 5px;
      display: none;
    }
    &.q-field--filled.q-field--highlighted .q-field__control:before {
      background-color: #0001;
    }
  }
  &:hover > .q-input > .q-field__after {
    display: flex;
  }
}

.character-menu {
  .q-item {
    color: global.$secondary;
  }
  .selected-character-item {
    background-color: rgba(global.$primary, 0.2);
  }
}
</style>
