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
      ref="surface"
      class="surface"
      @mousedown="onSurfaceMouseDown"
      @mousemove="onSurfaceMouseMove"
      @mouseleave="onSurfaceMouseLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRaw, watch } from "vue";
import { QBtn } from "quasar";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
// import type { Tempo } from "@/domain/project/type";
import type {
  VolumeEditorInput,
  VolumeEditorPosition,
} from "@/sing/volumeEditorStateMachine/common";

/*
const props = defineProps<{
  playheadTicks: number;
  tempos: Tempo[];
  tpqn: number;
  zoomX: number;
  zoomY: number;
}>();
*/

const store = useStore();
const { previewVolumeEdit, stateMachineProcess } = useVolumeEditorStateMachine({
  state: {
    get tpqn() {
      return store.state.tpqn;
    },
    get tempos() {
      return store.state.tempos;
    },
    get sequencerZoomX() {
      return store.state.sequencerZoomX;
    },
    get sequencerZoomY() {
      return store.state.sequencerZoomY;
    },
    get sequencerVolumeTool() {
      return store.state.sequencerVolumeTool;
    },
  },
  getters: {
    get SELECTED_TRACK_ID() {
      return store.getters.SELECTED_TRACK_ID;
    },
    get PLAYHEAD_POSITION() {
      return store.getters.PLAYHEAD_POSITION;
    },
  },
  actions: {
    COMMAND_SET_VOLUME_EDIT_DATA: store.actions.COMMAND_SET_VOLUME_EDIT_DATA,
    COMMAND_ERASE_VOLUME_EDIT_DATA:
      store.actions.COMMAND_ERASE_VOLUME_EDIT_DATA,
  },
});

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);

const setTool = (value: VolumeEditTool) => {
  if (value === tool.value) {
    return;
  }
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({
    sequencerVolumeTool: value,
  });
  console.log(`[VolumeEditor] tool -> ${value}`);
};

const surface = ref<HTMLElement | null>(null);
const isDragging = ref(false);

const emitToStateMachine = (
  mouseEvent: MouseEvent,
  targetArea: VolumeEditorInput["targetArea"],
) => {
  const dummyPosition: VolumeEditorPosition = {
    frame: 0,
    amplitude: 1,
  };
  stateMachineProcess({
    type: "mouseEvent",
    targetArea,
    mouseEvent,
    position: dummyPosition,
  });
  console.log(`[VolumeEditor] ${targetArea}:${mouseEvent.type}`);
};

const onSurfaceMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) {
    return;
  }
  isDragging.value = true;
  emitToStateMachine(event, "Editor");
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("mouseup", onWindowMouseUp);
};

const onSurfaceMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  emitToStateMachine(event, "Editor");
};

const onSurfaceMouseLeave = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  emitToStateMachine(event, "Window");
};

const onWindowMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  emitToStateMachine(event, "Window");
};

const onWindowMouseUp = (event: MouseEvent) => {
  if (!isDragging.value) {
    return;
  }
  emitToStateMachine(event, "Window");
  isDragging.value = false;
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
};

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("mouseup", onWindowMouseUp);
});

watch(
  previewVolumeEdit,
  (next) => {
    // NOTE: デバッグ用
    const raw = next != undefined ? toRaw(next) : undefined;
    if (raw) {
      console.log("[VolumeEditor] state:", raw);
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

.surface {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  cursor: crosshair;
  text-align: center;
}
</style>
