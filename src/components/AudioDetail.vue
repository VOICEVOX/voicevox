<template>
  <div
    v-show="activeAudioKey"
    class="full-height root relarive-absolute-wrapper"
  >
    <div>
      <div class="side">
        <div class="detail-selector">
          <q-tabs vertical class="text-secondary" v-model="selectedDetail">
            <q-tab label="ｱｸｾﾝﾄ" name="accent" />
            <q-tab label="ｲﾝﾄﾈｰｼｮﾝ" name="intonation" />
          </q-tabs>
        </div>
        <div class="play-button-wrapper">
          <template v-if="!nowPlayingContinuously">
            <q-btn
              v-if="!nowPlaying && !nowGenerating"
              fab
              color="primary"
              text-color="secondary"
              icon="play_arrow"
              @click="play"
            ></q-btn>
            <q-btn
              v-else
              fab
              color="primary"
              text-color="secondary"
              icon="stop"
              @click="stop"
            ></q-btn>
            <q-btn
              round
              aria-label="音声ファイルとして保存"
              size="small"
              icon="file_download"
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
              @changeAccent="changeAccent"
            />
          </template>
          <template v-if="selectedDetail === 'intonation'">
            <div
              v-for="(mora, moraIndex) in accentPhrase.moras"
              :key="moraIndex"
              class="q-mb-sm pitch-cell"
              :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
            >
              <!-- div for input width -->
              <div
                @mouseenter="setPitchLabel(true, accentPhraseIndex, moraIndex)"
                @mouseleave="setPitchLabel(false)"
              >
                <q-badge
                  class="pitch-label"
                  text-color="secondary"
                  v-if="
                    (pitchLabel.visible || pitchLabel.panning) &&
                    pitchLabel.accentPhraseIndex == accentPhraseIndex &&
                    pitchLabel.moraIndex == moraIndex &&
                    mora.pitch > 0
                  "
                >
                  {{ mora.pitch.toPrecision(3) }}
                </q-badge>
                <q-slider
                  vertical
                  reverse
                  snap
                  :min="3"
                  :max="6.5"
                  :step="0.01"
                  :disable="uiLocked || mora.pitch == 0"
                  v-model="mora.pitch"
                  @change="
                    setAudioMoraPitch(
                      accentPhraseIndex,
                      moraIndex,
                      parseFloat($event)
                    )
                  "
                  @wheel="
                    setAudioMoraPitchByScroll(
                      accentPhraseIndex,
                      moraIndex,
                      mora.pitch,
                      $event.deltaY,
                      $event.ctrlKey
                    )
                  "
                  @pan="setPitchPanning"
                />
              </div>
            </div>
            <div v-if="accentPhrase.pauseMora" />
          </template>
          <template
            v-for="(mora, moraIndex) in accentPhrase.moras"
            :key="moraIndex"
          >
            <div
              class="text-cell"
              :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
            >
              {{ mora.text }}
            </div>
            <div
              v-if="
                accentPhraseIndex < accentPhrases.length - 1 ||
                moraIndex < accentPhrase.moras.length - 1
              "
              @click="
                uiLocked ||
                  toggleAccentPhraseSplit(accentPhraseIndex, moraIndex, false)
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
                uiLocked ||
                  toggleAccentPhraseSplit(accentPhraseIndex, null, true)
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
import { computed, defineComponent, reactive, ref } from "vue";
import { useStore } from "@/store";
import {
  ACTIVE_AUDIO_KEY,
  CHANGE_ACCENT,
  SET_AUDIO_MORA_PITCH,
  CHANGE_ACCENT_PHRASE_SPLIT,
  PLAY_AUDIO,
  STOP_AUDIO,
  GENERATE_AND_SAVE_AUDIO,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";
import Mousetrap from "mousetrap";
import AudioAccent from "./AudioAccent.vue";

export default defineComponent({
  components: { AudioAccent },

  name: "AudioDetail",

  setup() {
    const store = useStore();

    // add hotkeys with mousetrap
    Mousetrap.bind("space", () => {
      if (!nowPlaying.value && !nowGenerating.value) {
        play();
      } else {
        stop();
      }
    });

    Mousetrap.bind("1", () => {
      selectedDetail.value = "accent";
    });

    Mousetrap.bind("2", () => {
      selectedDetail.value = "intonation";
    });

    // detect shift key and set flag, preventing changes in intonation while scrolling around
    let shiftKeyFlag = false;

    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === "Shift") shiftKeyFlag = false;
    }
    window.addEventListener("keyup", handleKeyPress);

    function setShiftKeyFlag(event: KeyboardEvent) {
      if (event.shiftKey) shiftKeyFlag = true;
    }
    window.addEventListener("keydown", setShiftKeyFlag);

    // detail selector
    type DetailTypes = "accent" | "intonation";
    const selectedDetail = ref<DetailTypes>("accent");
    const selectDetail = (index: number) => {
      selectedDetail.value = index === 0 ? "accent" : "intonation";
    };

    // accent phrase
    const activeAudioKey = computed<string | null>(
      () => store.getters[ACTIVE_AUDIO_KEY]
    );
    const uiLocked = computed(() => store.getters[UI_LOCKED]);

    const audioItem = computed(() =>
      activeAudioKey.value ? store.state.audioItems[activeAudioKey.value] : null
    );
    const query = computed(() => audioItem.value?.query);
    const accentPhrases = computed(() => query.value?.accentPhrases);

    const previewAccentPhraseIndex = ref<number | undefined>(undefined);

    const changeAccent = ([accentPhraseIndex, accent]: [number, number]) => {
      store.dispatch(CHANGE_ACCENT, {
        audioKey: activeAudioKey.value!,
        accentPhraseIndex,
        accent,
      });
    };

    const toggleAccentPhraseSplit = (
      accentPhraseIndex: number,
      moraIndex: number | null,
      isPause: boolean
    ) => {
      store.dispatch(CHANGE_ACCENT_PHRASE_SPLIT, {
        audioKey: activeAudioKey.value!,
        accentPhraseIndex,
        moraIndex,
        isPause,
      });
    };

    const setAudioMoraPitch = (
      accentPhraseIndex: number,
      moraIndex: number,
      pitch: number
    ) => {
      store.dispatch(SET_AUDIO_MORA_PITCH, {
        audioKey: activeAudioKey.value!,
        accentPhraseIndex,
        moraIndex,
        pitch,
      });
    };

    const setAudioMoraPitchByScroll = (
      accentPhraseIndex: number,
      moraIndex: number,
      moraPitch: number,
      deltaY: number,
      withDetailedStep: boolean
    ) => {
      const step = withDetailedStep ? 0.01 : 0.1;
      let pitch = moraPitch - (deltaY > 0 ? step : -step);
      pitch = Math.round(pitch * 1e2) / 1e2;
      if (!uiLocked.value && !shiftKeyFlag && 6.5 >= pitch && pitch >= 3)
        setAudioMoraPitch(accentPhraseIndex, moraIndex, pitch);
    };

    // audio play
    const play = () => {
      store.dispatch(PLAY_AUDIO, { audioKey: activeAudioKey.value! });
    };

    const stop = () => {
      store.dispatch(STOP_AUDIO, { audioKey: activeAudioKey.value! });
    };

    // save
    const save = () => {
      store.dispatch(GENERATE_AND_SAVE_AUDIO, {
        audioKey: activeAudioKey.value!,
        encoding: store.state.fileEncoding,
      });
    };

    const nowPlaying = computed(
      () => store.state.audioStates[activeAudioKey.value!]?.nowPlaying
    );
    const nowGenerating = computed(
      () => store.state.audioStates[activeAudioKey.value!]?.nowGenerating
    );

    // continuously play
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

    const pitchLabel = reactive({
      visible: false,
      // NOTE: q-slider操作中の表示のON/OFFは@panに渡ってくるphaseで判定する
      // SEE: https://github.com/quasarframework/quasar/issues/7739#issuecomment-689664504
      panning: false,
      accentPhraseIndex: -1,
      moraIndex: -1,
    });

    const setPitchLabel = (
      visible: boolean,
      accentPhraseIndex: number | undefined,
      moraIndex: number | undefined
    ) => {
      pitchLabel.visible = visible;
      pitchLabel.accentPhraseIndex =
        accentPhraseIndex ?? pitchLabel.accentPhraseIndex;
      pitchLabel.moraIndex = moraIndex ?? pitchLabel.moraIndex;
    };

    const setPitchPanning = (panningPhase: string) => {
      pitchLabel.panning = panningPhase === "start";
    };

    return {
      selectDetail,
      selectedDetail,
      activeAudioKey,
      uiLocked,
      audioItem,
      query,
      accentPhrases,
      previewAccentPhraseIndex,
      changeAccent,
      toggleAccentPhraseSplit,
      setAudioMoraPitch,
      setAudioMoraPitchByScroll,
      play,
      stop,
      save,
      nowPlaying,
      nowGenerating,
      nowPlayingContinuously,
      pitchLabel,
      setPitchLabel,
      setPitchPanning,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

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
      background-color: rgba(global.$primary, 0.3);
      :deep(.q-tab__indicator) {
        background-color: global.$primary;
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
          div {
            position: absolute;
            top: 8px;
            bottom: 8px;
            .q-slider {
              height: calc(100% - #{$pitch-label-height + 12px});
              margin-top: $pitch-label-height + 12px;
              min-width: 30px;
              max-width: 30px;
              :deep(.q-slider__track-container--v) {
                margin-left: -1.5px;
                width: 3px;
              }
            }
            .pitch-label {
              height: $pitch-label-height;
              padding: 0px 8px;
              transform: translateX(-50%) translateX(15px);
            }
          }
        }
      }
    }
  }
}
</style>
