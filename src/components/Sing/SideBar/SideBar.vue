<template>
  <div class="sidebar">
    <div class="tracks-header">
      トラック一覧
      <QSpace />
      <QBtn
        rounded
        unelevated
        size="0.75rem"
        padding="xs sm"
        :disable="uiLocked"
        @click="addTrack"
      >
        追加
      </QBtn>
      <QBtn
        rounded
        unelevated
        size="0.75rem"
        padding="xs sm"
        :disable="uiLocked || tracks.size === 1"
        @click="deleteTrack"
      >
        削除
      </QBtn>
    </div>
    <Draggable
      tag="QList"
      :modelValue="trackOrder"
      itemKey="id"
      handle=".track-handle"
      class="tracks"
      dragClass="dragging"
      @update:modelValue="reorderTracks"
      @start="isDragging = true"
      @end="isDragging = false"
    >
      <template #item="{ element: trackId }">
        <div>
          <!-- 上のdivを消すとDraggableが動かなくなる -->
          <!-- （上のコメントはtemplate直下に置くとエラーが出る） -->
          <TrackItem :trackId draggableClass="track-handle" />
        </div>
      </template>
    </Draggable>
    <div class="tracks-footer">
      <QBtn
        color="default"
        icon="headset_off"
        rounded
        outline
        dense
        size="sm"
        :disable="uiLocked || !isThereSoloTrack"
        class="track-list-button"
        @click="unsoloAllTracks"
      >
        <QTooltip :delay="500">ソロを解除</QTooltip>
      </QBtn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import Draggable from "vuedraggable";
import { QList } from "quasar";
import TrackItem from "./TrackItem.vue";
import { useStore } from "@/store";
import { TrackId } from "@/type/preload";

// https://github.com/SortableJS/vue.draggable.next/issues/211#issuecomment-1718863764
Draggable.components = { ...Draggable.components, QList };

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const tracks = computed(() => store.state.tracks);
const isThereSoloTrack = computed(() =>
  [...tracks.value.values()].some((track) => track.solo),
);

const trackOrder = computed(() => store.state.trackOrder);
const selectedTrackId = computed(() => store.state.selectedTrackId);

const addTrack = async () => {
  store.dispatch("COMMAND_ADD_TRACK");
};
const deleteTrack = () => {
  if (tracks.value.size === 1) return;
  store.dispatch("COMMAND_DELETE_TRACK", {
    trackId: selectedTrackId.value,
  });
};

const unsoloAllTracks = () => {
  if (store.state.songUndoableTrackControl.soloMute) {
    store.dispatch("COMMAND_UNSOLO_ALL_TRACKS");
  } else {
    store.dispatch("UNSOLO_ALL_TRACKS");
  }
};

const isDragging = ref(false);
const reorderTracks = (trackOrder: TrackId[]) => {
  store.dispatch("COMMAND_REORDER_TRACKS", {
    trackOrder,
  });
};
</script>
<style scoped lang="scss">
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.sidebar {
  width: 100%;
  height: 100%;
  background-color: colors.$background;
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-top: 1px solid colors.$sequencer-sub-divider;
  border-right: 1px solid colors.$sequencer-main-divider;
}

.tracks {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
}

.tracks-header,
.tracks-footer {
  display: flex;
  background: colors.$background;
  z-index: 10;
  align-items: center;
}
.tracks-header {
  border-bottom: 1px solid colors.$sequencer-sub-divider;

  padding: 0.5rem;
  padding-left: 1rem;
}
.tracks-footer {
  border-top: 1px solid colors.$sequencer-sub-divider;
  justify-content: end;

  padding: 0.5rem 1.25rem;
}

.track-list-button {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;

  color: colors.$display;

  &::before {
    border-color: rgba(colors.$display-rgb, 0.5);
  }
}
</style>
