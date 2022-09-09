<template>
  <div class="full-height root relative-absolute-wrapper">
    <div>
      <div class="side">
        <div class="detail-selector">
          <q-tabs dense vertical class="text-display" v-model="selectedDetail">
            <q-tab name="accent" label="ｱｸｾﾝﾄ" />
            <q-tab name="pitch" label="ｲﾝﾄﾈｰｼｮﾝ" />
            <q-tab name="length" label="長さ" />
          </q-tabs>
        </div>
        <div class="play-button-wrapper">
          <template v-if="!nowPlayingContinuously">
            <q-btn
              v-if="!nowPlaying && !nowGenerating"
              fab
              color="primary-light"
              text-color="display-on-primary"
              icon="play_arrow"
              @click="play"
            ></q-btn>
            <q-btn
              v-else
              fab
              color="primary-light"
              text-color="display-on-primary"
              icon="stop"
              @click="stop"
              :disable="nowGenerating"
            ></q-btn>
          </template>
        </div>
      </div>

      <div class="overflow-hidden-y accent-phrase-table" ref="audioDetail">
        <tip
          tip-key="tweakableSliderByScroll"
          v-if="selectedDetail === 'pitch'"
          class="tip-tweakable-slider-by-scroll"
        >
          <p>
            マウスホイールを使って<br />
            スライダーを微調整できます。
          </p>
          ホイール: ±0.1<br />
          Ctrl + ホイール: ±0.01
        </tip>
        <div
          v-for="(accentPhrase, accentPhraseIndex) in accentPhrases"
          :key="accentPhraseIndex"
          class="mora-table"
          :class="[
            accentPhraseIndex === activePoint && 'mora-table-focus',
            uiLocked || 'mora-table-hover',
          ]"
          @click="setPlayAndStartPoint(accentPhraseIndex)"
          :ref="addAccentPhraseElem"
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
                :min="minPitch"
                :max="maxPitch"
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
                :min="minMoraLength"
                :max="maxMoraLength"
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
                :min="minMoraLength"
                :max="maxMoraLength"
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
              class="text-cell"
              :class="{
                'text-cell-hovered': isHovered(
                  mora.vowel,
                  accentPhraseIndex,
                  moraIndex
                ),
              }"
              :style="{
                'grid-column': `${moraIndex * 2 + 1} / span 1`,
              }"
              @mouseover="handleHoverText(true, accentPhraseIndex, moraIndex)"
              @mouseleave="handleHoverText(false, accentPhraseIndex, moraIndex)"
              @click.stop="
                uiLocked ||
                  handleChangeVoicing(mora, accentPhraseIndex, moraIndex)
              "
            >
              <span class="text-cell-inner">
                {{ getHoveredText(mora, accentPhraseIndex, moraIndex) }}
              </span>
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
              @click.stop="
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
            <div class="text-cell">
              <span class="text-cell-inner">
                {{ accentPhrase.pauseMora.text }}
              </span>
            </div>
            <div
              @click.stop="
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
  nextTick,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import Tip from "./Tip.vue";
import AudioAccent from "./AudioAccent.vue";
import AudioParameter from "./AudioParameter.vue";
import { HotkeyAction, HotkeyReturnType, MoraDataType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { Mora } from "@/openapi/models";

export default defineComponent({
  components: { AudioAccent, AudioParameter, Tip },

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
        "ｱｸｾﾝﾄ欄を表示",
        () => {
          selectedDetail.value = "accent";
        },
      ],
      [
        "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
        () => {
          selectedDetail.value = "pitch";
        },
      ],
      [
        "長さ欄を表示",
        () => {
          selectedDetail.value = "length";
        },
      ],
      [
        "全体のイントネーションをリセット",
        () => {
          if (!uiLocked.value && store.getters.ACTIVE_AUDIO_KEY) {
            store.dispatch("COMMAND_RESET_MORA_PITCH_AND_LENGTH", {
              audioKey: store.getters.ACTIVE_AUDIO_KEY,
            });
          }
        },
      ],
      [
        "選択中のアクセント句のイントネーションをリセット",
        () => {
          if (
            !uiLocked.value &&
            store.getters.ACTIVE_AUDIO_KEY &&
            store.state.audioPlayStartPoint !== undefined
          ) {
            store.dispatch("COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH", {
              audioKey: store.getters.ACTIVE_AUDIO_KEY,
              accentPhraseIndex: store.state.audioPlayStartPoint,
            });
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

    // accent phrase
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const audioItem = computed(
      () => store.state.audioItems[props.activeAudioKey]
    );
    const query = computed(() => audioItem.value?.query);
    const accentPhrases = computed(() => query.value?.accentPhrases);

    const activePointScrollMode = computed(
      () => store.state.activePointScrollMode
    );

    // 再生開始アクセント句
    const startPoint = computed({
      get: () => {
        return store.state.audioPlayStartPoint;
      },
      set: (startPoint) => {
        store.dispatch("SET_AUDIO_PLAY_START_POINT", { startPoint });
      },
    });
    // アクティブ(再生されている状態)なアクセント句
    const activePoint = ref<number | undefined>(undefined);

    const setPlayAndStartPoint = (accentPhraseIndex: number) => {
      // UIロック中に再生位置を変えても特に問題は起きないと思われるが、
      // UIロックというものにそぐわない挙動になるので何もしないようにする
      if (uiLocked.value) return;

      if (activePoint.value !== accentPhraseIndex) {
        activePoint.value = accentPhraseIndex;
        startPoint.value = accentPhraseIndex;
      } else {
        // 選択解除で最初から再生できるようにする
        activePoint.value = undefined;
        startPoint.value = undefined;
      }
    };

    const lastPitches = ref<number[][]>([]);
    watch(accentPhrases, async (newPhrases) => {
      activePoint.value = startPoint.value;
      // 連続再生時に、最初に選択されていた場所に戻るためにscrollToActivePointを呼ぶ必要があるが、
      // DOMの描画が少し遅いので、nextTickをはさむ
      await nextTick();
      scrollToActivePoint();
      if (newPhrases) {
        lastPitches.value = newPhrases.map((phrase) =>
          phrase.moras.map((mora) => mora.pitch)
        );
      } else {
        lastPitches.value = [];
      }
    });

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

    const maxPitch = 6.5;
    const minPitch = 3;
    const maxMoraLength = 0.3;
    const minMoraLength = 0;
    const changeMoraData = (
      accentPhraseIndex: number,
      moraIndex: number,
      data: number,
      type: MoraDataType
    ) => {
      if (!altKeyFlag.value) {
        if (type == "pitch") {
          lastPitches.value[accentPhraseIndex][moraIndex] = data;
        }
        store.dispatch("COMMAND_SET_AUDIO_MORA_DATA", {
          audioKey: props.activeAudioKey,
          accentPhraseIndex,
          moraIndex,
          data,
          type,
        });
      } else {
        if (accentPhrases.value === undefined) {
          throw Error("accentPhrases.value === undefined");
        }
        store.dispatch("COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE", {
          audioKey: props.activeAudioKey,
          accentPhraseIndex,
          moraIndex,
          data,
          type,
        });
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
            textColor: "display",
          },
        });
      }
    };

    const stop = () => {
      store.dispatch("STOP_AUDIO", { audioKey: props.activeAudioKey });
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

    const audioDetail = ref<HTMLElement>();
    let accentPhraseElems: HTMLElement[] = [];
    const addAccentPhraseElem = (elem: HTMLElement) => {
      if (elem) {
        accentPhraseElems.push(elem);
      }
    };
    onBeforeUpdate(() => {
      accentPhraseElems = [];
    });

    const scrollToActivePoint = () => {
      if (
        activePoint.value === undefined ||
        !audioDetail.value ||
        accentPhraseElems.length === 0
      )
        return;
      const elem = accentPhraseElems[activePoint.value];

      if (activePointScrollMode.value === "CONTINUOUSLY") {
        const scrollCount = Math.max(
          elem.offsetLeft -
            audioDetail.value.offsetLeft +
            elem.offsetWidth / 2 -
            audioDetail.value.offsetWidth / 2,
          0
        );
        audioDetail.value.scroll(scrollCount, 0);
      } else if (activePointScrollMode.value === "PAGE") {
        const displayedPart =
          audioDetail.value.scrollLeft + audioDetail.value.offsetWidth;
        const nextAccentPhraseStart =
          elem.offsetLeft - audioDetail.value.offsetLeft;
        const nextAccentPhraseEnd = nextAccentPhraseStart + elem.offsetWidth;
        // 再生しようとしているアクセント句が表示範囲外にある時に、自動スクロールを行う
        if (
          nextAccentPhraseEnd <= audioDetail.value.scrollLeft ||
          displayedPart <= nextAccentPhraseEnd
        ) {
          const scrollCount = elem.offsetLeft - audioDetail.value.offsetLeft;
          audioDetail.value.scroll(scrollCount, 0);
        }
      } else {
        // activePointScrollMode.value === "OFF"
        return;
      }
    };

    // NodeJS.Timeout型が直接指定できないので、typeofとReturnTypeで取ってきている
    let focusInterval: ReturnType<typeof setInterval> | undefined;
    watch(nowPlaying, async (newState) => {
      if (newState) {
        const accentPhraseOffsets = await store.dispatch(
          "GET_AUDIO_PLAY_OFFSETS",
          {
            audioKey: props.activeAudioKey,
          }
        );
        // 現在再生されているaudio elementの再生時刻を0.01秒毎に取得(監視)し、
        // それに合わせてフォーカスするアクセント句を変えていく
        focusInterval = setInterval(() => {
          const currentTime = store.getters.ACTIVE_AUDIO_ELEM_CURRENT_TIME;
          for (let i = 1; i < accentPhraseOffsets.length; i++) {
            if (
              currentTime !== undefined &&
              accentPhraseOffsets[i - 1] <= currentTime &&
              currentTime < accentPhraseOffsets[i]
            ) {
              activePoint.value = i - 1;
              scrollToActivePoint();
            }
          }
        }, 10);
      } else if (focusInterval !== undefined) {
        clearInterval(focusInterval);
        focusInterval = undefined;
        // startPointがundefinedの場合、一旦最初のアクセント句までスクロール、その後activePointの選択を解除(undefinedに)する
        activePoint.value = startPoint.value ?? 0;
        scrollToActivePoint();
        if (startPoint.value === undefined)
          activePoint.value = startPoint.value;
      }
    });

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

    const isHovered = (
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
        } else if (selectedDetail.value == "pitch") {
          if (
            accentPhraseIndex === pitchHoveredInfo.accentPhraseIndex &&
            moraIndex === pitchHoveredInfo.moraIndex &&
            unvoicableVowels.indexOf(vowel) > -1
          ) {
            isHover = true;
          }
        }
      }
      return isHover;
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
    const altKeyFlag = ref(false);

    const keyEventListter = (event: KeyboardEvent) => {
      shiftKeyFlag.value = event.shiftKey;
      altKeyFlag.value = event.altKey;
    };

    const handleChangeVoicing = (
      mora: Mora,
      accentPhraseIndex: number,
      moraIndex: number
    ) => {
      if (
        selectedDetail.value == "pitch" &&
        unvoicableVowels.indexOf(mora.vowel) > -1
      ) {
        let data = 0;
        if (mora.pitch == 0) {
          if (lastPitches.value[accentPhraseIndex][moraIndex] == 0) {
            // 元々無声だった場合、適当な値を代入
            data = 5.5;
          } else {
            data = lastPitches.value[accentPhraseIndex][moraIndex];
          }
        }
        changeMoraData(accentPhraseIndex, moraIndex, data, "voicing");
      }
    };

    onMounted(() => {
      window.addEventListener("keyup", keyEventListter);
      document.addEventListener("keydown", keyEventListter);
    });

    onUnmounted(() => {
      window.removeEventListener("keyup", keyEventListter);
      document.removeEventListener("keydown", keyEventListter);
    });

    return {
      maxPitch,
      minPitch,
      maxMoraLength,
      minMoraLength,
      selectDetail,
      selectedDetail,
      activePoint,
      setPlayAndStartPoint,
      uiLocked,
      audioItem,
      query,
      accentPhrases,
      changeAccent,
      toggleAccentPhraseSplit,
      changeMoraData,
      play,
      stop,
      nowPlaying,
      nowGenerating,
      nowPlayingContinuously,
      addAccentPhraseElem,
      pronunciationByPhrase,
      handleChangePronounce,
      handleHoverText,
      handleLengthHoverText,
      isHovered,
      getHoveredText,
      shiftKeyFlag,
      handleChangeVoicing,
      audioDetail,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

$pitch-label-height: 24px;

.tip-tweakable-slider-by-scroll {
  position: absolute;
  right: 4px;
  top: 4px;
}

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
      background-color: rgba(colors.$primary-light-rgb, 0.3);
      :deep(.q-tab__indicator) {
        background-color: colors.$primary-light;
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
    margin-left: 4px;
    margin-right: 4px;
    margin-bottom: 4px;
    padding-left: 4px;

    display: flex;
    overflow-x: scroll;

    .mora-table {
      display: inline-grid;
      align-self: stretch;
      grid-template-rows: 1fr 60px 30px;

      div {
        padding: 0px;
        &.text-cell {
          min-width: 20px;
          max-width: 20px;
          grid-row-start: 3;
          text-align: center;
          white-space: nowrap;
          color: colors.$display;
          position: relative;

          .text-cell-inner {
            position: absolute;
            transform: translateX(-50%);
            z-index: 10;
          }
        }
        &.text-cell-hovered {
          font-weight: bold;
          cursor: pointer;
        }
        &.splitter-cell {
          min-width: 20px;
          max-width: 20px;
          grid-row: 3 / span 1;
          z-index: vars.$detail-view-splitter-cell-z-index;
        }
        &.splitter-cell:hover {
          background-color: colors.$text-splitter-hover;
          cursor: pointer;
        }
        &.splitter-cell-be-split {
          min-width: 40px;
          max-width: 40px;
          grid-row: 1 / span 3;
        }
        &.splitter-cell-be-split-pause {
          min-width: 20px;
          max-width: 20px;
        }
        &.accent-cell {
          grid-row: 2 / span 1;
          div {
            min-width: 20px + 20px;
            max-width: 20px + 20px;
            display: inline-block;
            cursor: pointer;
          }
        }
        &.pitch-cell {
          grid-row: 1 / span 2;
          min-width: 20px;
          max-width: 20px;
          display: inline-block;
          position: relative;
        }
      }
    }

    .mora-table-hover:hover {
      cursor: pointer;
      background-color: colors.$active-point-hover;
    }

    .mora-table-focus {
      // hover色に負けるので、importantが必要
      background-color: colors.$active-point-focus !important;
    }
  }
}
</style>
