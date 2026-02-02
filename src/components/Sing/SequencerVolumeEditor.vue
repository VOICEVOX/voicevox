<!-- TODO: 現状は座標計算し、ステートマシンやstoreに状態が通るかまでを確認するためのデバッグ用コンポーネント
 今後のUI実装で修正する
-->
<template>
  <div class="volume-editor">
    <div>
      <QBtn
        :color="tool === 'DRAW' ? 'primary' : 'secondary'"
        dense
        unelevated
        label="Draw"
        @click="setTool('DRAW')"
      />
      <QBtn
        :color="tool === 'ERASE' ? 'primary' : 'secondary'"
        dense
        unelevated
        label="Erase"
        @click="setTool('ERASE')"
      />
    </div>

    <div
      ref="viewportElement"
      class="volume-editor-surface"
      @mousedown="onSurfaceMouseDown"
      @mousemove="onSurfaceMouseMove"
      @mouseleave="onSurfaceMouseLeave"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  watch,
} from "vue";
import { QBtn } from "quasar";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
import type {
  PositionOnVolumeEditor,
  VolumeEditorInput,
} from "@/sing/volumeEditorStateMachine/common";
import { tickToSecond } from "@/sing/music";
import { clamp } from "@/sing/utility";
import { getTotalTicks } from "@/sing/rulerHelper"; // TODO: ルーラーから切り出して共通化する
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue"; // TODO: これも共通化できそう
import { createLogger } from "@/helpers/log";
const { info } = createLogger("SequencerPitch");

const store = useStore();
const { volumePreviewEdit, stateMachineProcess } =
  useVolumeEditorStateMachine(store);

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const numMeasuresContext = inject(numMeasuresInjectionKey, null);

const setTool = (value: VolumeEditTool) => {
  if (value === tool.value) {
    return;
  }
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({
    sequencerVolumeTool: value,
  });
  info(`[ParameterPanelVolume] tool -> ${value}`);
};

onMounted(() => {
  if (store.state.parameterPanelEditTarget !== "VOLUME") {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }
});

const viewportElement = ref<HTMLElement | null>(null);
const isDragging = ref(false);

// 座標変換処理
// TODO: マウスイベントのたびに処理を行うのは非効率...現状はデバッグ確認用
const computeViewportPosition = (
  mouseEvent: MouseEvent,
): PositionOnVolumeEditor => {
  const viewport = viewportElement.value;
  if (viewport == null) {
    throw new Error("volume editor viewport element is null.");
  }

  // ビューポート要素のピクセルサイズ
  const viewportRect = viewport.getBoundingClientRect();

  // ビューポート左上基準のローカルピクセル座標
  const viewportX = mouseEvent.clientX - viewportRect.left;
  const viewportY = mouseEvent.clientY - viewportRect.top;

  // TODO: ドラッグが要素外に飛んでいる場合の処理がいりそう

  // 時間方向のビューポート位置を0-1の比率に正規化
  const timelineRatioX = viewportX / viewportRect.width;
  const timelineTotalTicks = getTotalTicks(
    store.state.timeSignatures,
    numMeasuresContext?.numMeasures.value ?? 0,
    store.state.tpqn,
  );
  const timelineDurationSeconds = tickToSecond(
    timelineTotalTicks,
    store.state.tempos,
    store.state.tpqn,
  );
  const timelineFrameSpan = Math.max(
    Math.round(timelineDurationSeconds * store.state.editorFrameRate),
    selectedTrack.value?.volumeEditData.length ?? 0,
    1,
  );
  // フレーム位置
  const targetFrame = Math.round(timelineRatioX * timelineFrameSpan);

  // 振幅0-1
  // TODO: いまのところただの線形の値...dBスケールなどにするかは別途考慮
  const amplitudeY = 1 - viewportY / viewportRect.height;
  const amplitudeRatio = clamp(amplitudeY, 0, 1);

  return {
    frame: targetFrame,
    value: amplitudeRatio,
  };
};

const dispatchVolumeEditorEvent = (
  mouseEvent: MouseEvent,
  targetArea: VolumeEditorInput["targetArea"],
) => {
  const position = computeViewportPosition(mouseEvent);

  stateMachineProcess({
    type: "mouseEvent",
    targetArea,
    mouseEvent,
    position,
  });

  info(`[ParameterPanelVolume] ${targetArea}`, position);
};

const onSurfaceMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) {
    return;
  }
  isDragging.value = true;
  dispatchVolumeEditorEvent(event, "Editor");
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("mouseup", onWindowMouseUp);
};

const onSurfaceMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Editor");
};

const onSurfaceMouseLeave = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
};

const onWindowMouseUp = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  dispatchVolumeEditorEvent(event, "Window");
  isDragging.value = false;
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
};

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
});

watch(
  volumePreviewEdit,
  (next) => {
    // NOTE: デバッグ用
    const raw = next != undefined ? toRaw(next) : undefined;
    if (raw) {
      info("[VolumeEditor] state:", raw);
    }
  },
  { deep: false },
);
</script>

<style scoped lang="scss">
.volume-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.volume-editor-surface {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  cursor: crosshair;
  text-align: center;
}
</style>
