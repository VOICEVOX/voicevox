<template>
  <div class="sidebar">
    <Draggable
      tag="QList"
      :model-value="tracks"
      item-key="id"
      handle=".track-handle"
      class="tracks"
      drag-class="dragging"
      @update:model-value="reorderTracks"
      @start="isDragging = true"
      @end="isDragging = false"
    >
      <template #header>
        <QItemLabel header class="tracks-header"
          >トラック一覧
          <QBtn
            v-if="isThereSoloTrack"
            color="default"
            icon="headset_off"
            rounded
            outline
            dense
            size="sm"
            :disable="uiLocked"
            class="unsolo-button"
            @click="unsoloAllTracks"
          >
            <QTooltip>ソロを解除</QTooltip>
          </QBtn>
        </QItemLabel>
      </template>
      <template #item="{ element: track }">
        <div>
          <TrackItem :track="track" />
        </div>
      </template>

      <template #footer>
        <QItem
          v-ripple
          class="create-track-item"
          clickable
          :disable="uiLocked"
          @click="createTrack"
        >
          <QItemSection avatar>
            <QIcon color="display" name="add" />
          </QItemSection>
          <QItemSection>
            <QItemLabel>トラックを追加</QItemLabel>
          </QItemSection>
        </QItem>
      </template>
    </Draggable>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import Draggable from "vuedraggable";
import { QList } from "quasar";
import TrackItem from "./TrackItem.vue";
import { useStore } from "@/store";
import { Track } from "@/store/type";

// https://github.com/SortableJS/vue.draggable.next/issues/211#issuecomment-1718863764
Draggable.components = { ...Draggable.components, QList };

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const tracks = computed(() => store.state.tracks);
const isThereSoloTrack = computed(() =>
  tracks.value.some((track) => track.solo)
);

const selectedTrack = computed(() => store.getters.SELECTED_TRACK);

const createTrack = () => {
  const singer = selectedTrack.value.singer;
  if (!singer) return;

  store.dispatch("COMMAND_CREATE_TRACK", {
    singer,
  });
};

const unsoloAllTracks = () => {
  store.dispatch("COMMAND_UNSOLO_ALL_TRACKS");
};

const isDragging = ref(false);
const reorderTracks = (newTracks: Track[]) => {
  store.dispatch("COMMAND_REORDER_TRACKS", {
    trackIds: newTracks.map((track) => track.id),
  });
};
</script>
<style scoped lang="scss">
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;

.sidebar {
  width: vars.$sidebar-width;
  height: 100%;
  background-color: colors.$background;
  display: flex;
  border-top: 1px solid colors.$sequencer-sub-divider;
  border-right: 1px solid colors.$sequencer-main-divider;
}

.tracks {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.tracks-header {
  position: relative;
}

.unsolo-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);

  width: 1.75rem;
  height: 1.75rem;
  padding: 0;

  color: colors.$display;

  ::before {
    border-color: rgba(colors.$display-rgb, 0.5);
  }
}
</style>
