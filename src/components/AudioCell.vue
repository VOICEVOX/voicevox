<template>
  <div
    class="audio-cell"
    @mouseover="mouseOverAction"
    @mouseleave="mouseLeaveAction"
  >
    <q-btn flat class="q-pa-none character-button" :disable="uiLocked">
      <!-- q-imgだとdisableのタイミングで点滅する -->
      <img class="q-pa-none q-ma-none" :src="characterIconUrl" />
      <q-menu class="character-menu">
        <q-list>
          <q-item
            v-for="(characterInfo, index) in characterInfos"
            :key="index"
            clickable
            v-close-popup
            active-class="selected-character-item"
            :active="index === selectedCharacterInfo.metas.speaker"
            @click="changeCharacterIndex(index)"
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
            <q-item-section>{{ characterInfo.metas.name }}</q-item-section>
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
      :error="audioItem.text.length >= 80"
      :model-value="audioItem.text"
      @update:model-value="setAudioText"
      @change="willRemove || updateAudioQuery($event)"
      @paste="pasteOnAudioCell"
      @focus="setActiveAudioKey()"
      @keydown.shift.delete.exact="removeCell"
      @keydown.prevent.up.exact="moveUpCell"
      @keydown.prevent.down.exact="moveDownCell"
      @keydown.shift.enter.exact="addCellBellow"
      @keyup.escape.exact="blurCell"
      @mouseup.right="onRightClickTextField"
    >
      <template v-slot:error>
        文章が長いと正常に動作しない可能性があります。
        句読点の位置で文章を分割してください。
      </template>
      <template #after v-if="hoverFlag && deleteButtonEnable">
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
import { computed, defineComponent, ref } from "vue";
import { useStore } from "@/store";
import {
  FETCH_ACCENT_PHRASES,
  FETCH_AUDIO_QUERY,
  GENERATE_AND_SAVE_AUDIO,
  HAVE_AUDIO_QUERY,
  SET_ACTIVE_AUDIO_KEY,
  SET_AUDIO_TEXT,
  CHANGE_CHARACTER_INDEX,
  REGISTER_AUDIO_ITEM,
  PLAY_AUDIO,
  STOP_AUDIO,
  REMOVE_AUDIO_ITEM,
  IS_ACTIVE,
  PUT_TEXTS,
  OPEN_TEXT_EDIT_CONTEXT_MENU,
} from "@/store/audio";
import { AudioItem } from "@/store/type";
import { UI_LOCKED } from "@/store/ui";
import { CharacterInfo } from "@/type/preload";
import { QInput } from "quasar";

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

    const uiLocked = computed(() => store.getters[UI_LOCKED]);
    const haveAudioQuery = computed(() =>
      store.getters[HAVE_AUDIO_QUERY](props.audioKey)
    );

    const selectedCharacterInfo = computed(() =>
      characterInfos.value != undefined &&
      audioItem.value.characterIndex != undefined
        ? characterInfos.value[audioItem.value.characterIndex]
        : undefined
    );

    const characterIconUrl = computed(() =>
      URL.createObjectURL(selectedCharacterInfo.value?.iconBlob)
    );

    // TODO: change audio textにしてvuexに載せ替える
    const setAudioText = async (text: string) => {
      console.log(text);
      await store.dispatch(SET_AUDIO_TEXT, { audioKey: props.audioKey, text });
    };
    const updateAudioQuery = async () => {
      if (!haveAudioQuery.value) {
        store.dispatch(FETCH_AUDIO_QUERY, { audioKey: props.audioKey });
      } else {
        store.dispatch(FETCH_ACCENT_PHRASES, { audioKey: props.audioKey });
      }
    };
    const changeCharacterIndex = (characterIndex: number) => {
      store.dispatch(CHANGE_CHARACTER_INDEX, {
        audioKey: props.audioKey,
        characterIndex,
      });
    };
    const setActiveAudioKey = () => {
      store.dispatch(SET_ACTIVE_AUDIO_KEY, { audioKey: props.audioKey });
    };
    const save = () => {
      store.dispatch(GENERATE_AND_SAVE_AUDIO, { audioKey: props.audioKey });
    };

    const play = () => {
      store.dispatch(PLAY_AUDIO, { audioKey: props.audioKey });
    };

    const stop = () => {
      store.dispatch(STOP_AUDIO, { audioKey: props.audioKey });
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
          if (audioItem.value.text == "") {
            const text = texts.shift();
            if (text == undefined) return;
            setAudioText(text);
            updateAudioQuery();
          }

          store.dispatch(PUT_TEXTS, {
            texts,
            characterIndex: audioItem.value.characterIndex,
            prevAudioKey,
          });
        }
      }
    };

    // 選択されている
    const isActive = computed(() => store.getters[IS_ACTIVE](props.audioKey));

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

        store.dispatch(REMOVE_AUDIO_ITEM, { audioKey: props.audioKey });
      }
    };

    // 削除ボタンの有効／無効判定
    const deleteButtonEnable = computed(() => {
      return 1 < audioKeys.value.length;
    });

    // テキスト編集エリアの右クリック
    const onRightClickTextField = () => {
      store.dispatch(OPEN_TEXT_EDIT_CONTEXT_MENU);
    };

    // 下にセルを追加
    const addCellBellow = async () => {
      const audioItem: AudioItem = { text: "", characterIndex: 0 };
      await store.dispatch(REGISTER_AUDIO_ITEM, {
        audioItem,
        prevAudioKey: props.audioKey,
      });
      moveDownCell();
    };

    // blur cell on pressing escape key
    const blurCell = () => {
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

    // ホバー
    const hoverFlag = ref(false);

    const mouseOverAction = () => {
      hoverFlag.value = true;
    };

    const mouseLeaveAction = () => {
      hoverFlag.value = false;
    };

    return {
      characterInfos,
      audioItem,
      deleteButtonEnable,
      uiLocked,
      nowPlaying,
      nowGenerating,
      selectedCharacterInfo,
      characterIconUrl,
      setAudioText,
      updateAudioQuery,
      changeCharacterIndex,
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
      hoverFlag,
      mouseOverAction,
      mouseLeaveAction,
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
    }
    &.q-field--filled.q-field--highlighted .q-field__control:before {
      background-color: #0001;
    }
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
