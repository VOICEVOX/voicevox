<template>
  <div class="sidebar">
    <div class="tracks-header">
      <button
        :disable="uiLocked || tracks.size == 1"
        class="track-add-button"
        @click="addTrack"
      >
        <QIcon name="add" />
      </button>
      <QBtn
        v-show="tracks.size > 1"
        color="default"
        icon="delete_outline"
        rounded
        dense
        size="sm"
        :disable="uiLocked"
        class="track-list-button"
        @click="deleteTrack"
      >
        <QTooltip :delay="500">トラックを削除</QTooltip>
      </QBtn>
      <button
        v-if="isThereSoloTrack"
        class="track-unsolo-all-button"
        :disable="uiLocked || !isThereSoloTrack"
        @click="unsoloAllTracks"
      >
        すべてのソロ解除
      </button>
    </div>
    <Draggable
      tag="QList"
      :modelValue="trackOrder"
      :itemKey
      handle=".track-handle"
      class="tracks"
      dragClass="dragging"
      @update:modelValue="reorderTracks"
    >
      <template #item="{ element: trackId }">
        <TrackItem :trackId draggableClass="track-handle" />
      </template>
    </Draggable>
    <div class="tracks-footer"></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import Draggable from "vuedraggable";
import { QList } from "quasar";
import TrackItem from "./TrackItem.vue";
import { useStore } from "@/store";
import { TrackId } from "@/type/preload";

// DraggableのコンテナにQListを使うための設定。
// https://github.com/SortableJS/vue.draggable.next/issues/211#issuecomment-1718863764
Draggable.components = { ...Draggable.components, QList };
const itemKey = (trackId: TrackId) => trackId;

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const tracks = computed(() => store.state.tracks);
const isThereSoloTrack = computed(() =>
  [...tracks.value.values()].some((track) => track.solo),
);

const trackOrder = computed(() => store.state.trackOrder);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);

const addTrack = async () => {
  const willNextSelectedTrackIndex =
    trackOrder.value.indexOf(selectedTrackId.value) + 1;
  await store.dispatch("COMMAND_INSERT_EMPTY_TRACK", {
    prevTrackId: selectedTrackId.value,
  });
  await store.dispatch("SELECT_TRACK", {
    trackId: trackOrder.value[willNextSelectedTrackIndex],
  });
};
const deleteTrack = async () => {
  if (tracks.value.size === 1) return;

  let willNextSelectedTrackIndex =
    trackOrder.value.indexOf(selectedTrackId.value) - 1;
  if (willNextSelectedTrackIndex < 0) {
    willNextSelectedTrackIndex = 0;
  }
  await store.dispatch("COMMAND_DELETE_TRACK", {
    trackId: selectedTrackId.value,
  });
  await store.dispatch("SELECT_TRACK", {
    trackId: trackOrder.value[willNextSelectedTrackIndex],
  });
};

const unsoloAllTracks = () => {
  if (store.state.undoableTrackOperations.soloAndMute) {
    store.dispatch("COMMAND_UNSOLO_ALL_TRACKS");
  } else {
    store.dispatch("UNSOLO_ALL_TRACKS");
  }
};

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
  background-color: var(--scheme-color-sing-toolbar);
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.tracks {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
}

.tracks-header {
  display: flex;
  background: var(--scheme-color-surface-container-high);
  align-items: center;
  justify-content: start;
  gap: 0.25rem;

  padding: 0.5rem;
  padding-left: 1rem;
  padding-right: 1.25rem;
}

.track-list-button {
  width: 2rem;
  height: 2rem;
  padding: 0;

  color: var(--scheme-color-on-surface-variant);
}

.track-add-button {
  appearance: none;
  background: var(--scheme-color-surface-variant);
  border: none;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--scheme-color-secondary-container);
  }
}

.track-unsolo-all-button {
  appearance: none;
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--scheme-color-on-secondary-container);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--scheme-color-surface-variant);
  }
}
</style>
