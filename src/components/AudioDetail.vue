<template>
  <div class="full-height root relative-absolute-wrapper">
    <div>
      <div class="side">
        <div class="detail-selector">
          <q-tabs v-model="selectedDetail" dense vertical class="text-display">
            <q-tab name="accent" label="ｱｸｾﾝﾄ" />
            <q-tab
              name="pitch"
              label="ｲﾝﾄﾈｰｼｮﾝ"
              :disable="
                !(supportedFeatures && supportedFeatures.adjustMoraPitch)
              "
            />
            <q-tab
              name="length"
              label="長さ"
              :disable="
                !(supportedFeatures && supportedFeatures.adjustPhonemeLength)
              "
            />
          </q-tabs>
        </div>
        <div class="play-button-wrapper">
          <q-btn
            v-if="!nowPlaying && !nowGenerating"
            fab
            color="primary"
            text-color="display-on-primary"
            icon="play_arrow"
            @click="play"
          ></q-btn>
          <q-btn
            v-else
            fab
            color="primary"
            text-color="display-on-primary"
            icon="stop"
            :disable="nowGenerating"
            @click="stop"
          ></q-btn>
        </div>
      </div>

      <div ref="audioDetail" class="overflow-hidden-y accent-phrase-table">
        <tool-tip
          v-if="selectedDetail === 'pitch'"
          tip-key="tweakableSliderByScroll"
          class="tip-tweakable-slider-by-scroll"
        >
          <p>
            マウスホイールを使って<br />
            スライダーを微調整できます。
          </p>
          ホイール: ±0.1<br />
          <span v-if="isMac">Command</span><span v-else>Ctrl</span> + ホイール:
          ±0.01<br />
          <span v-if="isMac">Option</span><span v-else>Alt</span> + ホイール:
          一括調整
        </tool-tip>
        <div
          v-for="(accentPhrase, accentPhraseIndex) in accentPhrases"
          :key="accentPhraseIndex"
          :ref="addAccentPhraseElem"
          class="mora-table"
          :class="[
            accentPhraseIndex === activePoint && 'mora-table-focus',
            uiLocked || 'mora-table-hover',
          ]"
          @click="setPlayAndStartPoint(accentPhraseIndex)"
        >
          <accent-phrase
            :audio-key="activeAudioKey"
            :accent-phrase="accentPhrase"
            :index="accentPhraseIndex"
            :is-last="
              accentPhrases !== undefined &&
              accentPhrases.length - 1 === accentPhraseIndex
            "
            :selected-detail="selectedDetail"
            :shift-key-flag="shiftKeyFlag"
            :alt-key-flag="altKeyFlag"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  ref,
  VNodeRef,
  watch,
} from "vue";
import ToolTip from "./ToolTip.vue";
import AccentPhrase from "./AccentPhrase.vue";
import { useStore } from "@/store";
import {
  AudioKey,
  HotkeyAction,
  HotkeyReturnType,
  isMac,
} from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { EngineManifest } from "@/openapi/models";

const props =
  defineProps<{
    activeAudioKey: AudioKey;
  }>();

const store = useStore();

const supportedFeatures = computed(
  () =>
    (audioItem.value?.voice.engineId &&
      store.state.engineIds.some(
        (id) => id === audioItem.value.voice.engineId
      ) &&
      store.state.engineManifests[audioItem.value.voice.engineId]
        .supportedFeatures) as EngineManifest["supportedFeatures"] | undefined
);

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
      if (supportedFeatures.value?.adjustMoraPitch) {
        selectedDetail.value = "pitch";
      }
    },
  ],
  [
    "長さ欄を表示",
    () => {
      if (supportedFeatures.value?.adjustPhonemeLength) {
        selectedDetail.value = "length";
      }
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

// accent phrase
const uiLocked = computed(() => store.getters.UI_LOCKED);

const audioItem = computed(() => store.state.audioItems[props.activeAudioKey]);
const query = computed(() => audioItem.value?.query);
const accentPhrases = computed(() => query.value?.accentPhrases);

// エンジンが変わったとき、selectedDetailが対応していないものを選択している場合はaccentに戻す
// TODO: 連続再生するとアクセントに移動してしまうため、タブの中身を全てdisabledにする、半透明divをかぶせるなど
//       タブ自体の無効化＆移動以外の方法で無効化する
watch(
  supportedFeatures,
  (newFeatures) => {
    if (
      (!newFeatures?.adjustMoraPitch && selectedDetail.value === "pitch") ||
      (!newFeatures?.adjustPhonemeLength && selectedDetail.value === "length")
    ) {
      selectedDetail.value = "accent";
    }
  },
  { immediate: true }
);

const activePointScrollMode = computed(() => store.state.activePointScrollMode);

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

watch(accentPhrases, async () => {
  activePoint.value = startPoint.value;
  // 連続再生時に、最初に選択されていた場所に戻るためにscrollToActivePointを呼ぶ必要があるが、
  // DOMの描画が少し遅いので、nextTickをはさむ
  await nextTick();
  scrollToActivePoint();
});

// audio play
const play = async () => {
  try {
    await store.dispatch("PLAY_AUDIO", {
      audioKey: props.activeAudioKey,
    });
  } catch (e) {
    let msg: string | undefined;
    // FIXME: GENERATE_AUDIO_FROM_AUDIO_ITEMのエラーを変えた場合変更する
    if (e instanceof Error && e.message === "VALID_MORPHING_ERROR") {
      msg = "モーフィングの設定が無効です。";
    } else {
      window.electron.logError(e);
    }
    store.dispatch("SHOW_ALERT_DIALOG", {
      title: "再生に失敗しました",
      message: msg ?? "エンジンの再起動をお試しください。",
    });
  }
};

const stop = () => {
  store.dispatch("STOP_AUDIO");
};

const nowPlaying = computed(() => store.getters.NOW_PLAYING);
const nowGenerating = computed(
  () => store.state.audioStates[props.activeAudioKey]?.nowGenerating
);

const audioDetail = ref<HTMLElement>();
let accentPhraseElems: HTMLElement[] = [];
const addAccentPhraseElem: VNodeRef = (elem) => {
  if (elem instanceof HTMLElement) {
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

let requestId: number | undefined;
watch(nowPlaying, async (newState) => {
  if (newState) {
    const accentPhraseOffsets = await store.dispatch("GET_AUDIO_PLAY_OFFSETS", {
      audioKey: props.activeAudioKey,
    });
    // 現在再生されているaudio elementの再生時刻を描画毎に取得(監視)し、
    // それに合わせてフォーカスするアクセント句を変えていく
    const focusAccentPhrase = () => {
      const currentTime = store.getters.ACTIVE_AUDIO_ELEM_CURRENT_TIME;
      if (currentTime === undefined) {
        throw new Error("currentTime === undefined)");
      }
      const playingAccentPhraseIndex =
        accentPhraseOffsets.findIndex(
          (currentOffset) => currentTime < currentOffset
        ) - 1;
      if (playingAccentPhraseIndex === -1) {
        // accentPhraseOffsets[0] は必ず 0 なので到達しないはず
        throw new Error("playingAccentPhraseIndex === -1");
      }
      if (playingAccentPhraseIndex === -2) {
        // データと音声ファイルの長さに誤差があるため許容
        // see https://github.com/VOICEVOX/voicevox/issues/785
        return;
      }
      if (activePoint.value !== playingAccentPhraseIndex) {
        activePoint.value = playingAccentPhraseIndex;
        scrollToActivePoint();
      }
      requestId = window.requestAnimationFrame(focusAccentPhrase);
    };
    requestId = window.requestAnimationFrame(focusAccentPhrase);
  } else if (requestId !== undefined) {
    window.cancelAnimationFrame(requestId);
    requestId = undefined;
    // startPointがundefinedの場合、一旦最初のアクセント句までスクロール、その後activePointの選択を解除(undefinedに)する
    activePoint.value = startPoint.value ?? 0;
    scrollToActivePoint();
    if (startPoint.value === undefined) activePoint.value = startPoint.value;
  }
});

const shiftKeyFlag = ref(false);
const altKeyFlag = ref(false);

const keyEventListter = (event: KeyboardEvent) => {
  shiftKeyFlag.value = event.shiftKey;
  altKeyFlag.value = event.altKey;
};

onMounted(() => {
  window.addEventListener("keyup", keyEventListter);
  document.addEventListener("keydown", keyEventListter);
});

onUnmounted(() => {
  window.removeEventListener("keyup", keyEventListter);
  document.removeEventListener("keydown", keyEventListter);
});
</script>

<style scoped lang="scss">
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
      background-color: rgba(colors.$primary-rgb, 0.3);
      :deep(.q-tab__indicator) {
        background-color: colors.$primary;
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

      &:last-child {
        padding-right: 20px;
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
