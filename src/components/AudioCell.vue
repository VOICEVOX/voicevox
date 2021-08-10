<template>
  <div
    class="audio-cell"
    v-on:mouseover="mouseOverAction"
    v-on:mouseleave="mouseLeaveAction"
  >
    <q-btn flat class="q-pa-none charactor-button">
      <q-img
        :ratio="1"
        :src="
          selectedCharactorInfo
            ? getCharactorIconUrl(selectedCharactorInfo)
            : undefined
        "
      />
      <q-menu class="charactor-menu">
        <q-list>
          <q-item
            v-for="(charactorInfo, index) in charactorInfos"
            :key="index"
            clickable
            v-close-popup
            active-class="selected-charactor-item"
            :active="index === selectedCharactorInfo.metas.speaker"
            @click="changeCharactorIndex(index)"
          >
            <q-item-section avatar>
              <q-avatar rounded size="2rem">
                <q-img :ratio="1" :src="getCharactorIconUrl(charactorInfo)" />
              </q-avatar>
            </q-item-section>
            <q-item-section>{{ charactorInfo.metas.name }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
    <q-input
      ref="textfield"
      filled
      class="full-width"
      style="height: 32px"
      :disable="uiLocked"
      v-model="audioItem.text"
      @change="willRemove || setAudioText($event)"
      @paste="pasteOnAudioCell($event)"
      @focus="setActiveAudioKey()"
      @keydown.delete.exact="tryToRemoveCell"
      @keydown.prevent.up.exact="moveUpCell"
      @keydown.prevent.down.exact="moveDownCell"
      @keydown.shift.enter.exact="addCellBellow"
      @mouseup.right="onRightClickTextField"
    >
      <template #after v-if="hoverFlag && deleteButtonEnable">
        <q-btn
          round
          flat
          icon="delete_outline"
          size="0.8rem"
          @click="removeCell"
        />
      </template>
    </q-input>
  </div>
</template>

<script lang="ts">
import { Component, computed, defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import {
  FETCH_ACCENT_PHRASES,
  FETCH_AUDIO_QUERY,
  GENERATE_AND_SAVE_AUDIO,
  HAVE_AUDIO_QUERY,
  SET_ACTIVE_AUDIO_KEY,
  SET_AUDIO_TEXT,
  CHANGE_CHARACTOR_INDEX,
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
import { CharactorInfo } from "@/type/preload";

export default defineComponent({
  name: "AudioCell",

  props: {
    audioKey: { type: String, required: true },
  },

  emits: ["focusCell"],

  setup(props, { emit }) {
    const store = useStore();
    const charactorInfos = computed(() => store.state.charactorInfos!);
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

    const selectedCharactorInfo = computed(() =>
      audioItem.value.charactorIndex !== undefined
        ? charactorInfos.value[audioItem.value.charactorIndex]
        : undefined
    );
    const selectorSpeakers = computed(() =>
      charactorInfos.value.map((charactorInfo, charactorIndex) => {
        return {
          text: "JVS" + charactorInfo.metas.name,
          value: charactorIndex,
        };
      })
    );

    // TODO: change audio textにしてvuexに載せ替える
    const setAudioText = async (text: string) => {
      await store.dispatch(SET_AUDIO_TEXT, { audioKey: props.audioKey, text });
      if (!haveAudioQuery.value) {
        store.dispatch(FETCH_AUDIO_QUERY, { audioKey: props.audioKey });
      } else {
        store.dispatch(FETCH_ACCENT_PHRASES, { audioKey: props.audioKey });
      }
    };
    const changeCharactorIndex = (charactorIndex: number) => {
      store.dispatch(CHANGE_CHARACTOR_INDEX, {
        audioKey: props.audioKey,
        charactorIndex,
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

    //長い文章をコピペしたときに句点（。）で自動区切りする
    //https://github.com/Hiroshiba/voicevox/issues/25
    const pasteOnAudioCell = async (evt: ClipboardEvent) => {
      if (evt.clipboardData) {
        //"。"と改行コードで区切り
        let splittedStringArr = evt.clipboardData
          .getData("text/plain")
          .split(/[。\n\r]/);
        //区切りがある場合、普段のPasteと別処理
        if (splittedStringArr.length > 1) {
          evt.preventDefault();
          let prevAudioKey = props.audioKey;
          //現在の欄が空欄の場合、最初の行だけ別処理
          if (audioItem.value.text == "") {
            setAudioText(splittedStringArr.shift()!);
          }
          store.dispatch(PUT_TEXTS, {
            texts: splittedStringArr,
            charIdx: audioItem.value.charactorIndex,
            prevAudioKey: prevAudioKey,
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

    // テキストが空白なら消去
    const tryToRemoveCell = async (e: Event) => {
      if (audioItem.value.text.length > 0) {
        return;
      }
      e.preventDefault();
      removeCell();
    };

    // テキスト編集エリアの右クリック
    const onRightClickTextField = () => {
      store.dispatch(OPEN_TEXT_EDIT_CONTEXT_MENU);
    };

    // 下にセルを追加
    const addCellBellow = async () => {
      const audioItem: AudioItem = { text: "", charactorIndex: 0 };
      await store.dispatch(REGISTER_AUDIO_ITEM, {
        audioItem,
        prevAudioKey: props.audioKey,
      });
      moveDownCell();
    };

    // フォーカス
    const textfield = ref<Component | any>();
    const focusTextField = () => {
      textfield.value!.focus();
    };

    // キャラクター選択
    const isOpenedCharactorList = ref(false);

    const getCharactorIconUrl = computed(
      () => (charactorInfo: CharactorInfo) =>
        URL.createObjectURL(charactorInfo.iconBlob)
    );

    const hoverFlag = ref(false);

    const mouseOverAction = () => {
      hoverFlag.value = true;
    };

    const mouseLeaveAction = () => {
      hoverFlag.value = false;
    };

    // 初期化
    onMounted(() => {
      if (audioItem.value.query == undefined) {
        store.dispatch(FETCH_AUDIO_QUERY, { audioKey: props.audioKey });
      }
    });

    return {
      charactorInfos,
      audioItem,
      deleteButtonEnable,
      uiLocked,
      nowPlaying,
      nowGenerating,
      selectedCharactorInfo,
      selectorSpeakers,
      setAudioText,
      changeCharactorIndex,
      setActiveAudioKey,
      save,
      play,
      stop,
      willRemove,
      removeCell,
      tryToRemoveCell,
      addCellBellow,
      isActive,
      moveUpCell,
      moveDownCell,
      pasteOnAudioCell,
      onRightClickTextField,
      textfield,
      focusTextField,
      isOpenedCharactorList,
      getCharactorIconUrl,
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
  .charactor-button {
    border: solid 1px;
    border-color: global.$primary;
    font-size: 0;
    .q-img {
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
  }
}

.charactor-menu {
  .q-item {
    color: global.$secondary;
  }
  .selected-charactor-item {
    background-color: rgba(global.$primary, 0.2);
  }
}
</style>
