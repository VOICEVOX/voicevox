<template>
  <div class="sidebar">
    <div class="tracks-header">
      トラック一覧
      <QSpace />
      <QBtn
        v-show="tracks.size > 1"
        color="default"
        icon="delete_outline"
        rounded
        outline
        dense
        size="sm"
        :disable="uiLocked"
        class="track-list-button"
        @click="deleteTrack"
      >
        <QTooltip :delay="500">トラックを削除</QTooltip>
      </QBtn>
      <QBtn
        color="default"
        icon="add"
        rounded
        outline
        dense
        size="sm"
        :disable="uiLocked"
        class="track-list-button"
        @click="addTrack"
      >
        <QTooltip :delay="500">トラックを追加</QTooltip>
      </QBtn>
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
        <QTooltip :delay="500">すべてのソロを解除</QTooltip>
      </QBtn>
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
// @ts-expect-error 型エラーが出るが、ちゃんと動くので無視。
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
  await store.actions.COMMAND_INSERT_EMPTY_TRACK({
    prevTrackId: selectedTrackId.value,
  });
  await store.actions.SELECT_TRACK({
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
  await store.actions.COMMAND_DELETE_TRACK({
    trackId: selectedTrackId.value,
  });
  await store.actions.SELECT_TRACK({
    trackId: trackOrder.value[willNextSelectedTrackIndex],
  });
};

const unsoloAllTracks = () => {
  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_UNSOLO_ALL_TRACKS();
  } else {
    void store.actions.UNSOLO_ALL_TRACKS();
  }
};

const reorderTracks = (trackOrder: TrackId[]) => {
  void store.actions.COMMAND_REORDER_TRACKS({
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

.tracks-header {
  display: flex;
  background: colors.$background;
  align-items: center;
  gap: 0.25rem;

  border-bottom: 1px solid colors.$sequencer-sub-divider;

  padding: 0.5rem;
  padding-left: 1rem;
  padding-right: 1.25rem;
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
