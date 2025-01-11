<template>
  <div class="full-height root relative-absolute-wrapper">
    <div>
      <div class="side">
        <div class="detail-selector">
          <QTabs v-model="selectedDetail" dense vertical class="text-display">
            <QTab name="accent" label="ｱｸｾﾝﾄ" />
            <QTab
              name="pitch"
              label="ｲﾝﾄﾈｰｼｮﾝ"
              :disable="
                !(supportedFeatures && supportedFeatures.adjustMoraPitch)
              "
            />
            <QTab
              name="length"
              label="長さ"
              :disable="
                !(supportedFeatures && supportedFeatures.adjustPhonemeLength)
              "
            />
          </QTabs>
        </div>
        <div class="play-button-wrapper">
          <QBtn
            v-if="!nowPlaying && !nowGenerating"
            fab
            color="primary"
            textColor="display-on-primary"
            icon="play_arrow"
            @click="play"
          ></QBtn>
          <QBtn
            v-else
            fab
            color="primary"
            textColor="display-on-primary"
            icon="stop"
            :disable="nowGenerating"
            @click="stop"
          ></QBtn>
        </div>
      </div>

      <div ref="audioDetail" class="overflow-hidden-y accent-phrase-table">
        <ToolTip
          v-if="selectedDetail === 'pitch'"
          tipKey="tweakableSliderByScroll"
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
        </ToolTip>
        <AccentPhrase
          v-for="(accentPhrase, accentPhraseIndex) in accentPhrases"
          :key="accentPhraseIndex"
          ref="accentPhraseComponents"
          :audioKey="activeAudioKey"
          :accentPhrase
          :index="accentPhraseIndex"
          :isLast="
            accentPhrases !== undefined &&
            accentPhrases.length - 1 === accentPhraseIndex
          "
          :isActive="accentPhraseIndex === activePoint"
          :selectedDetail
          :shiftKeyFlag="isShiftKeyDown"
          :altKeyFlag="isAltKeyDown"
          @click="setPlayAndStartPoint"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import AccentPhrase from "./AccentPhrase.vue";
import ToolTip from "@/components/ToolTip.vue";
import { useStore } from "@/store";
import { AudioKey } from "@/type/preload";
import { isMac } from "@/helpers/platform";
import { EngineManifest } from "@/openapi/models";
import { useShiftKey, useAltKey } from "@/composables/useModifierKey";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { handlePossiblyNotMorphableError } from "@/store/audioGenerate";

const props = defineProps<{
  activeAudioKey: AudioKey;
}>();

const store = useStore();

const supportedFeatures = computed(
  () =>
    (audioItem.value?.voice.engineId &&
      store.state.engineIds.some(
        (id) => id === audioItem.value.voice.engineId,
      ) &&
      store.state.engineManifests[audioItem.value.voice.engineId]
        .supportedFeatures) as EngineManifest["supportedFeatures"] | undefined,
);

const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "talk",
  name: "再生/停止",
  callback: () => {
    if (!nowPlaying.value && !nowGenerating.value && !uiLocked.value) {
      void play();
    } else {
      stop();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "ｱｸｾﾝﾄ欄を表示",
  callback: () => {
    selectedDetail.value = "accent";
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
  callback: () => {
    if (supportedFeatures.value?.adjustMoraPitch) {
      selectedDetail.value = "pitch";
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "長さ欄を表示",
  callback: () => {
    if (supportedFeatures.value?.adjustPhonemeLength) {
      selectedDetail.value = "length";
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "全体のイントネーションをリセット",
  callback: () => {
    if (!uiLocked.value && store.getters.ACTIVE_AUDIO_KEY) {
      const audioKeys = store.state.experimentalSetting.enableMultiSelect
        ? store.getters.SELECTED_AUDIO_KEYS
        : [store.getters.ACTIVE_AUDIO_KEY];
      void store.actions.COMMAND_MULTI_RESET_MORA_PITCH_AND_LENGTH({
        audioKeys,
      });
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "選択中のアクセント句のイントネーションをリセット",
  callback: () => {
    if (
      !uiLocked.value &&
      store.getters.ACTIVE_AUDIO_KEY &&
      store.getters.AUDIO_PLAY_START_POINT != undefined
    ) {
      void store.actions.COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH({
        audioKey: store.getters.ACTIVE_AUDIO_KEY,
        accentPhraseIndex: store.getters.AUDIO_PLAY_START_POINT,
      });
    }
  },
});

// detail selector
type DetailTypes = "accent" | "pitch" | "length";
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
  { immediate: true },
);

const activePointScrollMode = computed(() => store.state.activePointScrollMode);

// 再生開始アクセント句
const startPoint = computed({
  get: () => {
    return store.getters.AUDIO_PLAY_START_POINT;
  },
  set: (startPoint) => {
    void store.actions.SET_AUDIO_PLAY_START_POINT({ startPoint });
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
    await store.actions.PLAY_AUDIO({
      audioKey: props.activeAudioKey,
    });
  } catch (e) {
    const msg = handlePossiblyNotMorphableError(e);
    void store.actions.SHOW_ALERT_DIALOG({
      title: "再生に失敗しました",
      message: msg ?? "エンジンの再起動をお試しください。",
    });
  }
};

const stop = () => {
  void store.actions.STOP_AUDIO();
};

const nowPlaying = computed(() => store.getters.NOW_PLAYING);
const nowGenerating = computed(
  () => store.state.audioStates[props.activeAudioKey]?.nowGenerating,
);

const audioDetail = ref<HTMLElement>();

const accentPhraseComponents = ref<InstanceType<typeof AccentPhrase>[]>([]);

const scrollToActivePoint = () => {
  if (
    activePoint.value == undefined ||
    !audioDetail.value ||
    accentPhraseComponents.value.length === 0
  )
    return;
  const elem = accentPhraseComponents.value[activePoint.value].container;
  if (elem == undefined) throw new Error("elem == undefined");

  if (activePointScrollMode.value === "CONTINUOUSLY") {
    const scrollCount = Math.max(
      elem.offsetLeft -
        audioDetail.value.offsetLeft +
        elem.offsetWidth / 2 -
        audioDetail.value.offsetWidth / 2,
      0,
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
    const accentPhraseOffsets = await store.actions.GET_AUDIO_PLAY_OFFSETS({
      audioKey: props.activeAudioKey,
    });
    // 現在再生されているaudio elementの再生時刻を描画毎に取得(監視)し、
    // それに合わせてフォーカスするアクセント句を変えていく
    const focusAccentPhrase = () => {
      const currentTime = store.getters.ACTIVE_AUDIO_ELEM_CURRENT_TIME;
      if (currentTime == undefined) {
        throw new Error("currentTime === undefined)");
      }
      const playingAccentPhraseIndex =
        accentPhraseOffsets.findIndex(
          (currentOffset) => currentTime < currentOffset,
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
  } else if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
    requestId = undefined;
    // startPointがundefinedの場合、一旦最初のアクセント句までスクロール、その後activePointの選択を解除(undefinedに)する
    activePoint.value = startPoint.value ?? 0;
    scrollToActivePoint();
    if (startPoint.value == undefined) activePoint.value = startPoint.value;
  }
});

const isShiftKeyDown = useShiftKey();
const isAltKeyDown = useAltKey();
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

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
  }
}
</style>
