<template>
  <div class="full-height root relative-absolute-wrapper">
    <div>
      <div class="side">
        <div class="detail-selector">
          <q-tabs
            dense
            vertical
            class="text-secondary"
            v-model="selectedDetail"
          >
            <q-tab name="accent" label="ｱｸｾﾝﾄ" />
            <q-tab name="pitch" label="高さ" />
            <q-tab name="length" label="長さ" />
          </q-tabs>
        </div>
        <div class="play-button-wrapper">
          <template v-if="!nowPlayingContinuously">
            <q-btn
              v-if="!nowPlaying && !nowGenerating"
              fab
              color="primary-light"
              text-color="display-dark"
              icon="play_arrow"
              @click="play"
            ></q-btn>
            <q-btn
              v-else
              fab
              color="primary-light"
              text-color="display-dark"
              icon="stop"
              @click="stop"
            ></q-btn>
            <q-btn
              round
              aria-label="音声ファイルとして保存"
              size="small"
              icon="file_download"
              color="display-light"
              text-color="display-dark"
              @click="save()"
              :disable="nowPlaying || nowGenerating || uiLocked"
            ></q-btn>
          </template>
        </div>
      </div>

      <div class="overflow-hidden-y accent-phrase-table">
        <div
          v-for="(accentPhrase, accentPhraseIndex) in accentPhrases"
          :key="accentPhraseIndex"
          class="mora-table"
        >
          <template v-if="selectedDetail === 'accent'">
            <audio-accent
              :accentPhraseIndex="accentPhraseIndex"
              :accentPhrase="accentPhrase"
              :uiLocked="uiLocked"
              :shiftKeyFlag="shiftKeyFlag"
              @changeAccent="changeAccent"
            />
          </template>
          <template v-if="selectedDetail === 'pitch'">
            <div
              v-for="(mora, moraIndex) in accentPhrase.moras"
              :key="moraIndex"
              class="q-mb-sm pitch-cell"
              :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
            >
              <!-- div for input width -->
              <audio-parameter
                :moraIndex="moraIndex"
                :accentPhraseIndex="accentPhraseIndex"
                :value="mora.pitch"
                :uiLocked="uiLocked"
                :min="3"
                :max="6.5"
                :disable="mora.pitch == 0.0"
                :type="'pitch'"
                :clip="false"
                :shiftKeyFlag="shiftKeyFlag"
                @changeValue="changeMoraData"
              />
            </div>
            <div v-if="accentPhrase.pauseMora" />
          </template>
          <template v-if="selectedDetail === 'length'">
            <div
              v-for="(mora, moraIndex) in accentPhrase.moras"
              :key="moraIndex"
              class="q-mb-sm pitch-cell"
              :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
            >
              <!-- consonant length -->
              <audio-parameter
                v-if="mora.consonant"
                :moraIndex="moraIndex"
                :accentPhraseIndex="accentPhraseIndex"
                :value="mora.consonantLength"
                :uiLocked="uiLocked"
                :min="0"
                :max="0.3"
                :step="0.001"
                :type="'consonant'"
                :clip="true"
                :shiftKeyFlag="shiftKeyFlag"
                @changeValue="changeMoraData"
                @mouseOver="handleLengthHoverText"
              />
              <!-- vowel length -->
              <audio-parameter
                :moraIndex="moraIndex"
                :accentPhraseIndex="accentPhraseIndex"
                :value="mora.vowelLength"
                :uiLocked="uiLocked"
                :min="0"
                :max="0.3"
                :step="0.001"
                :type="'vowel'"
                :clip="mora.consonant ? true : false"
                :shiftKeyFlag="shiftKeyFlag"
                @changeValue="changeMoraData"
                @mouseOver="handleLengthHoverText"
              />
            </div>
          </template>
          <div
            class="q-mb-sm pitch-cell"
            v-if="accentPhrase.pauseMora && selectedDetail == 'length'"
            :style="{
              'grid-column': `${accentPhrase.moras.length * 2 + 1} / span 1`,
            }"
          >
            <!-- pause length -->
            <audio-parameter
              :moraIndex="accentPhrase.moras.length"
              :accentPhraseIndex="accentPhraseIndex"
              :value="accentPhrase.pauseMora.vowelLength"
              :uiLocked="uiLocked"
              :min="0"
              :max="1.0"
              :step="0.01"
              :type="'pause'"
              :shiftKeyFlag="shiftKeyFlag"
              @changeValue="changeMoraData"
            />
          </div>
          <template
            v-for="(mora, moraIndex) in accentPhrase.moras"
            :key="moraIndex"
          >
            <div
              :class="getHoveredClass(mora.vowel, accentPhraseIndex, moraIndex)"
              :style="{
                'grid-column': `${moraIndex * 2 + 1} / span 1`,
              }"
              @mouseover="handleHoverText(true, accentPhraseIndex, moraIndex)"
              @mouseleave="handleHoverText(false, accentPhraseIndex, moraIndex)"
              @click="handleChangeVoicing(mora, accentPhraseIndex, moraIndex)"
            >
              {{ getHoveredText(mora, accentPhraseIndex, moraIndex) }}
              <q-popup-edit
                v-if="selectedDetail == 'accent' && !uiLocked"
                :model-value="pronunciationByPhrase[accentPhraseIndex]"
                auto-save
                transition-show="none"
                transition-hide="none"
                v-slot="scope"
                @save="handleChangePronounce($event, accentPhraseIndex)"
              >
                <q-input
                  v-model="scope.value"
                  dense
                  :input-style="{
                    width: `${scope.value.length + 1}em`,
                    minWidth: '50px',
                  }"
                  autofocus
                  outlined
                  @keyup.enter="scope.set"
                />
              </q-popup-edit>
            </div>
            <div
              v-if="
                accentPhraseIndex < accentPhrases.length - 1 ||
                moraIndex < accentPhrase.moras.length - 1
              "
              @click="
                uiLocked ||
                  toggleAccentPhraseSplit(accentPhraseIndex, false, moraIndex)
              "
              :class="[
                'splitter-cell',
                {
                  'splitter-cell-be-split':
                    moraIndex == accentPhrase.moras.length - 1,
                  'splitter-cell-be-split-pause': accentPhrase.pauseMora,
                },
              ]"
              :style="{ 'grid-column': `${moraIndex * 2 + 2} / span 1` }"
            />
          </template>
          <template v-if="accentPhrase.pauseMora">
            <div class="text-cell">{{ accentPhrase.pauseMora.text }}</div>
            <div
              @click="
                uiLocked || toggleAccentPhraseSplit(accentPhraseIndex, true)
              "
              class="
                splitter-cell
                splitter-cell-be-split
                splitter-cell-be-split-pause
              "
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { SaveResultObject } from "@/store/type";
import AudioAccent from "./AudioAccent.vue";
import AudioParameter from "./AudioParameter.vue";
import { HotkeyAction, HotkeyReturnType, MoraDataType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { Mora } from "@/openapi/models";

export default defineComponent({
  components: { AudioAccent, AudioParameter },

  name: "AudioDetail",

  props: {
    activeAudioKey: { type: String, required: true },
  },

  setup(props) {
    const store = useStore();
    const $q = useQuasar();

    const hotkeyMap = new Map<HotkeyAction, () => HotkeyReturnType>([
      [
        "再生/停止",
        () => {
          if (!nowPlaying.value && !nowGenerating.value && !uiLocked.value) {
            play();
          } else {
            stop();
          }
        },
      ],
      [
        "一つだけ書き出し",
        () => {
          if (!uiLocked.value) {
            save();
          }
        },
      ],
      [
        "ｱｸｾﾝﾄ欄を表示",
        () => {
          if (!uiLocked.value) {
            selectedDetail.value = "accent";
          }
        },
      ],
      [
        "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
        () => {
          if (!uiLocked.value) {
            selectedDetail.value = "pitch";
          }
        },
      ],
      [
        "長さ欄を表示",
        () => {
          if (!uiLocked.value) {
            selectedDetail.value = "length";
          }
        },
      ],
    ]);
    // このコンポーネントは遅延評価なので手動でバインディングを行う
    setHotkeyFunctions(hotkeyMap, true);

    // detail selector
    type DetailTypes = "accent" | "pitch" | "length" | "play" | "stop" | "save";
    const selectedDetail = ref<DetailTypes>("accent");
    const selectDetail = (index: number) => {
      selectedDetail.value = index === 0 ? "accent" : "pitch";
    };
    const useVoicing = computed(() => store.state.useVoicing);

    // accent phrase
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const audioItem = computed(
      () => store.state.audioItems[props.activeAudioKey]
    );
    const query = computed(() => audioItem.value?.query);
    const accentPhrases = computed(() => query.value?.accentPhrases);

    const changeAccent = (accentPhraseIndex: number, accent: number) =>
      store.dispatch("COMMAND_CHANGE_ACCENT", {
        audioKey: props.activeAudioKey,
        accentPhraseIndex,
        accent,
      });
    const toggleAccentPhraseSplit = (
      accentPhraseIndex: number,
      isPause: boolean,
      moraIndex?: number
    ) => {
      store.dispatch("COMMAND_CHANGE_ACCENT_PHRASE_SPLIT", {
        audioKey: props.activeAudioKey,
        accentPhraseIndex,
        ...(!isPause
          ? { isPause, moraIndex: moraIndex as number }
          : { isPause }),
      });
    };

    const changeMoraData = (
      accentPhraseIndex: number,
      moraIndex: number,
      data: number,
      type: MoraDataType
    ) => {
      store.dispatch("COMMAND_SET_AUDIO_MORA_DATA", {
        audioKey: props.activeAudioKey,
        accentPhraseIndex,
        moraIndex,
        data,
        type,
      });
    };

    const tabAction = (actionType: DetailTypes) => {
      switch (actionType) {
        case "play":
          play();
          break;
        case "stop":
          stop();
          break;
        case "save":
          save();
          break;
      }
    };

    // audio play
    const play = async () => {
      try {
        await store.dispatch("PLAY_AUDIO", {
          audioKey: props.activeAudioKey,
        });
      } catch (e) {
        $q.dialog({
          title: "再生に失敗しました",
          message: "エンジンの再起動をお試しください。",
          ok: {
            label: "閉じる",
            flat: true,
            textColor: "secondary",
          },
        });
      }
    };

    const stop = () => {
      store.dispatch("STOP_AUDIO", { audioKey: props.activeAudioKey });
    };

    // save
    const save = async () => {
      const result: SaveResultObject = await store.dispatch(
        "GENERATE_AND_SAVE_AUDIO",
        {
          audioKey: props.activeAudioKey,
          encoding: store.state.savingSetting.fileEncoding,
        }
      );

      if (result.result === "SUCCESS" || result.result === "CANCELED") return;

      let msg = "";
      switch (result.result) {
        case "WRITE_ERROR":
          msg =
            "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。";
          break;
        case "ENGINE_ERROR":
          msg =
            "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
          break;
      }

      $q.dialog({
        title: "書き出しに失敗しました。",
        message: msg,
        ok: {
          label: "閉じる",
          flat: true,
          textColor: "secondary",
        },
      });
    };

    const nowPlaying = computed(
      () => store.state.audioStates[props.activeAudioKey]?.nowPlaying
    );
    const nowGenerating = computed(
      () => store.state.audioStates[props.activeAudioKey]?.nowGenerating
    );

    // continuously play
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

    const pronunciationByPhrase = computed(() => {
      let textArray: Array<string> = [];
      accentPhrases.value?.forEach((accentPhrase) => {
        let textString = "";
        accentPhrase.moras.forEach((mora) => {
          textString += mora.text;
        });
        if (accentPhrase.pauseMora) {
          textString += "、";
        }
        textArray.push(textString);
      });
      return textArray;
    });

    const handleChangePronounce = (
      newPronunciation: string,
      phraseIndex: number
    ) => {
      let popUntilPause = false;
      newPronunciation = newPronunciation.replace(",", "、");
      if (accentPhrases.value == undefined)
        throw new Error("accentPhrases.value == undefined");
      if (
        newPronunciation.slice(-1) == "、" &&
        accentPhrases.value.length - 1 != phraseIndex
      ) {
        newPronunciation += pronunciationByPhrase.value[phraseIndex + 1];
        popUntilPause = true;
      }
      store.dispatch("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
        audioKey: props.activeAudioKey,
        newPronunciation,
        accentPhraseIndex: phraseIndex,
        popUntilPause,
      });
    };

    type hoveredType = "vowel" | "consonant";

    type hoveredInfoType = {
      accentPhraseIndex: number | undefined;
      moraIndex?: number | undefined;
      type?: hoveredType;
    };

    const accentHoveredInfo = reactive<hoveredInfoType>({
      accentPhraseIndex: undefined,
    });

    const pitchHoveredInfo = reactive<hoveredInfoType>({
      accentPhraseIndex: undefined,
      moraIndex: undefined,
    });

    const lengthHoveredInfo = reactive<hoveredInfoType>({
      accentPhraseIndex: undefined,
      moraIndex: undefined,
      type: "vowel",
    });

    const handleHoverText = (
      isOver: boolean,
      phraseIndex: number,
      moraIndex: number
    ) => {
      if (selectedDetail.value == "accent") {
        if (isOver) {
          accentHoveredInfo.accentPhraseIndex = phraseIndex;
        } else {
          accentHoveredInfo.accentPhraseIndex = undefined;
        }
      } else if (selectedDetail.value == "pitch") {
        if (isOver) {
          pitchHoveredInfo.accentPhraseIndex = phraseIndex;
          pitchHoveredInfo.moraIndex = moraIndex;
        } else {
          pitchHoveredInfo.accentPhraseIndex = undefined;
          pitchHoveredInfo.moraIndex = undefined;
        }
      }
    };

    const handleLengthHoverText = (
      isOver: boolean,
      phoneme: hoveredType,
      phraseIndex: number,
      moraIndex?: number
    ) => {
      lengthHoveredInfo.type = phoneme;
      // the pause and pitch templates don't emit a mouseOver event
      if (isOver) {
        lengthHoveredInfo.accentPhraseIndex = phraseIndex;
        lengthHoveredInfo.moraIndex = moraIndex;
      } else {
        lengthHoveredInfo.accentPhraseIndex = undefined;
        lengthHoveredInfo.moraIndex = undefined;
      }
    };

    const unvoicableVowels = ["U", "I", "i", "u"];

    const getHoveredClass = (
      vowel: string,
      accentPhraseIndex: number,
      moraIndex: number
    ) => {
      let isHover = false;
      if (!uiLocked.value) {
        if (selectedDetail.value == "accent") {
          if (accentPhraseIndex === accentHoveredInfo.accentPhraseIndex) {
            isHover = true;
          }
        } else if (selectedDetail.value == "pitch" && useVoicing.value) {
          if (
            accentPhraseIndex === pitchHoveredInfo.accentPhraseIndex &&
            moraIndex === pitchHoveredInfo.moraIndex &&
            unvoicableVowels.indexOf(vowel) > -1
          ) {
            isHover = true;
          }
        }
      }
      if (isHover) return "text-cell-hovered";
      else return "text-cell";
    };

    const getHoveredText = (
      mora: Mora,
      accentPhraseIndex: number,
      moraIndex: number
    ) => {
      if (selectedDetail.value != "length") return mora.text;
      if (
        accentPhraseIndex === lengthHoveredInfo.accentPhraseIndex &&
        moraIndex === lengthHoveredInfo.moraIndex
      ) {
        if (lengthHoveredInfo.type == "vowel") {
          return mora.vowel.toUpperCase();
        } else {
          return mora.consonant?.toUpperCase();
        }
      } else {
        return mora.text;
      }
    };

    const shiftKeyFlag = ref(false);

    const setShiftKeyFlag = (event: KeyboardEvent) => {
      shiftKeyFlag.value = event.shiftKey;
    };

    function resetShiftKeyFlag(event: KeyboardEvent) {
      if (event.key === "Shift") shiftKeyFlag.value = false;
    }

    const handleChangeVoicing = (
      mora: Mora,
      accentPhraseIndex: number,
      moraIndex: number
    ) => {
      if (!uiLocked.value && useVoicing.value) {
        if (
          selectedDetail.value == "pitch" &&
          unvoicableVowels.indexOf(mora.vowel) > -1
        ) {
          let data = 0;
          if (mora.pitch == 0) {
            data = 5.5; // don't worry, it will be overwritten by template itself
          }
          changeMoraData(accentPhraseIndex, moraIndex, data, "voicing");
        }
      }
    };

    onMounted(() => {
      window.addEventListener("keyup", resetShiftKeyFlag);
      document.addEventListener("keydown", setShiftKeyFlag);
    });

    onUnmounted(() => {
      window.removeEventListener("keyup", resetShiftKeyFlag);
      document.removeEventListener("keydown", setShiftKeyFlag);
    });

    return {
      selectDetail,
      selectedDetail,
      uiLocked,
      audioItem,
      query,
      accentPhrases,
      changeAccent,
      toggleAccentPhraseSplit,
      changeMoraData,
      play,
      stop,
      save,
      nowPlaying,
      nowGenerating,
      nowPlayingContinuously,
      pronunciationByPhrase,
      handleChangePronounce,
      handleHoverText,
      handleLengthHoverText,
      getHoveredClass,
      getHoveredText,
      shiftKeyFlag,
      tabAction,
      handleChangeVoicing,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;
@import "~quasar/src/css/variables";

$pitch-label-height: 24px;

.root > div {
  display: flex;
  flex-direction: row;
  align-items: center;

  .side {
    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
    .detail-selector .q-tab--active {
      background-color: rgba(global.$primary-light-rgb, 0.3);
      :deep(.q-tab__indicator) {
        background-color: var(--color-primary-light);
      }
    }
    .play-button-wrapper {
      align-self: flex-end;
      display: flex;
      align-items: flex-end;
      flex-wrap: nowrap;
      flex-direction: row-reverse;
      justify-content: space-between;
      margin: 10px;
      gap: 0 5px;
    }
  }

  .accent-phrase-table {
    flex-grow: 1;
    align-self: stretch;
    margin-left: 5px;
    margin-right: 5px;
    margin-bottom: 5px;
    padding-left: 5px;

    display: flex;
    overflow-x: scroll;

    .mora-table {
      display: inline-grid;
      align-self: stretch;
      grid-template-rows: 1fr 60px 30px;

      div {
        padding: 0px;
        &.text-cell {
          min-width: 30px;
          max-width: 30px;
          grid-row-start: 3;
          text-align: center;
          color: global.$secondary;
        }
        &.text-cell-hovered {
          min-width: 30px;
          max-width: 30px;
          grid-row-start: 3;
          text-align: center;
          color: global.$secondary;
          font-weight: bold;
          cursor: pointer;
        }
        &.splitter-cell {
          min-width: 10px;
          max-width: 10px;
          grid-row: 3 / span 1;
          z-index: global.$detail-view-splitter-cell-z-index;
        }
        &.splitter-cell:hover {
          background-color: #cdf;
          cursor: pointer;
        }
        &.splitter-cell-be-split {
          min-width: 40px;
          max-width: 40px;
          grid-row: 1 / span 3;
        }
        &.splitter-cell-be-split-pause {
          min-width: 10px;
          max-width: 10px;
        }
        &.accent-cell {
          grid-row: 2 / span 1;
          div {
            min-width: 30px + 10px;
            max-width: 30px + 10px;
            display: inline-block;
            cursor: pointer;
          }
        }
        &.pitch-cell {
          grid-row: 1 / span 2;
          min-width: 30px;
          max-width: 30px;
          display: inline-block;
          position: relative;
        }
      }
    }
  }
}
</style>
