<template>
  <div
    v-show="activeAudioKey"
    class="full-height root relarive-absolute-wrapper"
  >
    <div>
      <div class="side">
        <div class="detail-selector">
          <q-tabs vertical class="text-primary" v-model="selectedDetail">
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
              icon="play_arrow"
              @click="play"
            ></q-btn>
            <q-btn v-else fab color="primary" icon="stop" @click="stop"></q-btn
          ></template>
        </div>
      </div>
      <div class="accent-phrase-table">
        <div
          v-for="(accentPhrase, accentPhraseIndex) in accentPhrases"
          :key="accentPhraseIndex"
          class="mora-table"
        >
          <template v-if="selectedDetail === 'accent'">
            <div
              class="accent-slider-cell"
              :style="{
                'grid-column': `1 / span ${accentPhrase.moras.length * 2 - 1}`,
              }"
            >
              <!-- div for input width -->
              <div>
                <div>
                  <q-slider
                    v-if="accentPhrase.moras.length > 1"
                    snap
                    :min="1"
                    :max="accentPhrase.moras.length"
                    :step="1"
                    :disable="uiLocked"
                    v-model="accentPhrase.accent"
                    @change="changeAccent(accentPhraseIndex, parseInt($event))"
                    @input="
                      changePreviewAccent(accentPhraseIndex, parseInt($event))
                    "
                  />
                </div>
              </div>
            </div>
            <div
              class="accent-draw-cell"
              :style="{
                'grid-column': `1 / span ${accentPhrase.moras.length * 2 - 1}`,
              }"
            >
              <svg :viewBox="`0 0 ${accentPhrase.moras.length * 40 - 10} 50`">
                <polyline
                  :points="
                    '' +
                    [...Array(accentPhrase.moras.length).keys()].map(
                      (index) =>
                        `${index * 40 + 15} ${
                          index + 1 == accentPhrase.accent ||
                          (index != 0 && index < accentPhrase.accent)
                            ? 5
                            : 45
                        }`
                    )
                  "
                  stroke="black"
                  fill="none"
                />
              </svg>
            </div>
            <template
              v-for="(mora, moraIndex) in accentPhrase.moras"
              :key="moraIndex"
            >
              <div
                @click="
                  uiLocked || changeAccent(accentPhraseIndex, moraIndex + 1)
                "
                :class="[
                  'accent-select-cell',
                  {
                    'accent-select-cell-selected':
                      accentPhrase.accent == moraIndex + 1,
                  },
                ]"
                :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
              >
                <svg width="29" height="50" viewBox="0 0 29 50">
                  <line x1="14" y1="0" x2="14" y2="50" stroke-width="1" />
                </svg>
              </div>
            </template>
          </template>
          <template v-if="selectedDetail === 'intonation'">
            <div
              v-for="(mora, moraIndex) in accentPhrase.moras"
              :key="moraIndex"
              class="pitch-cell"
              :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
            >
              <!-- div for input width -->
              <div>
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
                  'splitter-cell-splitted':
                    moraIndex == accentPhrase.moras.length - 1,
                  'splitter-cell-splitted-pause': accentPhrase.pauseMora,
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
                splitter-cell-splitted
                splitter-cell-splitted-pause
              "
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from "vue";
import { useStore } from "@/store";
import {
  ACTIVE_AUDIO_KEY,
  CHANGE_ACCENT,
  SET_AUDIO_MORA_PITCH,
  CHANGE_ACCENT_PHRASE_SPLIT,
  PLAY_AUDIO,
  STOP_AUDIO,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";

export default defineComponent({
  name: "AudioDetail",

  setup() {
    const store = useStore();

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

    const previewAccent = ref<number | undefined>(undefined);
    const previewAccentPhraseIndex = ref<number | undefined>(undefined);

    const changeAccent = (accentPhraseIndex: number, accent: number) => {
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

    const changePreviewAccent = (accentPhraseIndex: number, accent: number) => {
      previewAccent.value = accent;
      previewAccentPhraseIndex.value = accentPhraseIndex;
    };

    // audio play
    const play = () => {
      store.dispatch(PLAY_AUDIO, { audioKey: activeAudioKey.value! });
    };

    const stop = () => {
      store.dispatch(STOP_AUDIO, { audioKey: activeAudioKey.value! });
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

    return {
      selectDetail,
      selectedDetail,
      activeAudioKey,
      uiLocked,
      audioItem,
      query,
      accentPhrases,
      previewAccent,
      previewAccentPhraseIndex,
      changeAccent,
      toggleAccentPhraseSplit,
      setAudioMoraPitch,
      changePreviewAccent,
      play,
      stop,
      nowPlaying,
      nowGenerating,
      nowPlayingContinuously,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

.root > div {
  display: flex;
  flex-direction: row;
  align-items: center;

  .side {
    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
    .play-button-wrapper {
      align-self: flex-end;
      margin-right: 10px;
      margin-bottom: 10px;
    }
  }

  .accent-phrase-table {
    flex-grow: 1;
    align-self: stretch;
    margin-left: 5px;
    margin-right: 5px;
    margin-bottom: 5px;

    display: flex;
    overflow-x: scroll;

    .mora-table {
      display: inline-grid;
      align-self: stretch;
      grid-template-rows: 1fr 60px 30px;

      div {
        padding: 0px;
        &.accent-slider-cell {
          grid-row-start: 1;
          align-self: flex-end;

          margin-left: 5px;
          margin-right: 10px;
          position: relative;
          > div {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            > div {
              padding-left: 10px;
              padding-right: 5px;
            }
          }
        }
        &.accent-draw-cell {
          grid-row-start: 2;
          svg line {
            stroke: black;
          }
        }
        &.accent-select-cell {
          grid-row-start: 2;
          text-align: center;
          cursor: pointer;
          svg line {
            stroke: global.$primary;
            stroke-dasharray: 3;
          }
        }
        &.accent-select-cell-selected {
          svg line {
            stroke-dasharray: none;
            stroke-width: 3;
          }
        }
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
          z-index: global.$detail-veiw-splitter-cell-zindex;
        }
        &.splitter-cell:hover {
          background-color: #cdf;
          cursor: pointer;
        }
        &.splitter-cell-splitted {
          min-width: 40px;
          max-width: 40px;
          grid-row: 1 / span 3;
        }
        &.splitter-cell-splitted-pause {
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
              height: 100%;
              min-width: 30px;
              max-width: 30px;
            }
          }
        }
      }
    }
  }
}
</style>
