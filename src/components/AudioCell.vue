<template>
  <div
    class="audio-cell"
    v-on:mouseover="mouseOverAction"
    v-on:mouseleave="mouseLeaveAction">
    <mcw-menu-anchor>
      <button class="charactor-button" @click="isOpenedCharactorList = true">
        <img
          :src="
            selectedCharactorInfo
              ? getCharactorIconUrl(selectedCharactorInfo)
              : undefined
          "
        />
      </button>
      <mcw-menu
        v-model="isOpenedCharactorList"
        @select="({ index }) => changeCharactorIndex(index)"
        single-selection
        fixed
      >
        <mcw-list-item
          v-for="(charactorInfo, index) in charactorInfos"
          :key="index"
          ><img :src="getCharactorIconUrl(charactorInfo)" /><span>{{
            charactorInfo.metas.name
          }}</span></mcw-list-item
        >
      </mcw-menu>
    </mcw-menu-anchor>
    <mcw-textfield
      ref="textfield"
      v-model="audioItem.text"
      @change="willRemove || setAudioText($event.target.value)"
      @focus="setActiveAudioKey()"
      @keydown.delete.exact="tryToRemoveCell"
      @keydown.prevent.up.exact="moveUpCell"
      @keydown.prevent.down.exact="moveDownCell"
      :disabled="uiLocked"
    />
      <span
        v-show="hoverFlag"
        @click="removeCell"
      >🗑 削除</span
      >
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
  PLAY_AUDIO,
  STOP_AUDIO,
  REMOVE_AUDIO_ITEM,
  IS_ACTIVE,
} from "@/store/audio";
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
      // フォーカスを外したりREMOVEしたりすると、
      // テキストフィールドのchangeイベントが非同期に飛んでundefinedエラーになる
      // エラー防止のためにまずwillRemoveフラグを建てる
      willRemove.value = true;

      if (audioKeys.value.length > 1) {
        const index = audioKeys.value.indexOf(props.audioKey);
        if (index > 0) {
          emit("focusCell", { audioKey: audioKeys.value[index - 1] });
        } else {
          emit("focusCell", { audioKey: audioKeys.value[index + 1] });
        }
      }

      store.dispatch(REMOVE_AUDIO_ITEM, { audioKey: props.audioKey });
    };

    // テキストが空白なら消去
    const tryToRemoveCell = async (e: Event) => {
      if (audioItem.value.text.length > 0) {
        return;
      }
      e.preventDefault();
      removeCell();
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
      store.dispatch(FETCH_AUDIO_QUERY, { audioKey: props.audioKey });
    });

    return {
      charactorInfos,
      audioItem,
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
      isActive,
      moveUpCell,
      moveDownCell,
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
    border: solid 1.5px;
    border-color: global.$primary;
    padding: 0;
    margin: 0;
    background: none;
    font-size: 0;
    line-height: 0;
    overflow: visible;
    cursor: pointer;
    img {
      width: 2rem;
      height: 2rem;
      object-fit: scale-down;
    }
  }
  .mdc-list-item__text {
    height: 100%;
    img {
      height: 100%;
    }
  }
  .textfield-container {
    flex: auto;
    label {
      width: 100%;
      height: 2rem !important;
      background-color: transparent !important;
      .mdc-line-ripple {
        &::before,
        &::after {
          border-bottom-color: global.$primary !important;
        }
      }
    }
  }
}
</style>
