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
        <QItemLabel header>トラック一覧</QItemLabel>
      </template>
      <template #item="{ element: track }">
        <div>
          <QItem
            v-ripple
            clickable
            class="track-item"
            :active="track.id === selectedTrack.id"
            :disable="uiLocked"
            active-class="selected-item"
            @click="selectTrack(track.id)"
          >
            <div class="track-handle" />
            <QItemSection
              avatar
              :style="{
                opacity: tracksShouldPlay[track.id] ? 1 : 0.5,
              }"
            >
              <SingerIcon
                v-if="trackStyles[track.id]"
                round
                class="singer-icon"
                size="3rem"
                :style="trackStyles[track.id]!"
              />
              <QAvatar v-else round size="3rem" color="primary"
                ><span color="text-display-on-primary">?</span></QAvatar
              >
            </QItemSection>
            <QItemSection>
              <QItemLabel class="singer-name">
                {{
                  mapNullablePipe(
                    trackCharacters[track.id],
                    (trackCharacter) => trackCharacter.metas.speakerName
                  ) || "（不明なキャラクター）"
                }}
              </QItemLabel>
              <QItemLabel
                v-if="trackStyles[track.id]"
                caption
                class="singer-style"
              >
                {{ getStyleDescription(trackStyles[track.id]!) }}
              </QItemLabel>
            </QItemSection>
            <div side class="track-control">
              <QBtn
                color="default"
                :icon="track.mute ? 'volume_off' : 'volume_up'"
                round
                flat
                dense
                size="sm"
                :class="{ 'track-button-active': track.mute }"
                :disable="uiLocked"
                @click.stop="setTrackMute(track.id, !track.mute)"
              >
                <QTooltip>ミュート</QTooltip>
              </QBtn>
              <QBtn
                color="default"
                icon="headset"
                rounded
                flat
                dense
                size="sm"
                :class="{ 'track-button-active': track.solo }"
                :disable="uiLocked"
                @click.stop="setTrackSolo(track.id, !track.solo)"
              >
                <QTooltip>ソロ</QTooltip>
              </QBtn>
            </div>
          </QItem>

          <QItem
            v-if="!isDragging && track.id === selectedTrack.id"
            class="track-detail-container"
          >
            <div class="track-detail">
              <div class="pan">
                <div class="l">L</div>
                <QSlider
                  :model-value="track.pan"
                  :min="-1"
                  :max="1"
                  :step="0.1"
                  :markers="1"
                  selection-color="transparent"
                  :disable="uiLocked"
                  @change="setTrackPan(track.id, $event)"
                  @dblclick="setTrackPan(track.id, 0)"
                />
                <div class="r">R</div>
              </div>
              <div class="volume">
                <QIcon name="volume_down" class="l" size="1rem" />
                <QSlider
                  :model-value="track.volume"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  :markers="1"
                  :disable="uiLocked"
                  @change="setTrackVolume(track.id, $event)"
                  @dblclick="setTrackVolume(track.id, 1)"
                />
                <QIcon name="volume_up" class="r" size="1rem" />
              </div>
              <div>
                <QBtn
                  label="削除"
                  rounded
                  dense
                  flat
                  size="sm"
                  padding="xs sm"
                  :disable="tracks.length === 1 || uiLocked"
                  @click="deleteTrack(track.id)"
                />
              </div>
            </div>
          </QItem>
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
import SingerIcon from "./SingerIcon.vue";
import { useStore } from "@/store";
import { getStyleDescription } from "@/sing/viewHelper";
import { shouldPlay } from "@/sing/domain";
import { Track, TrackId } from "@/store/type";
import { mapNullablePipe } from "@/helpers/map";

// https://github.com/SortableJS/vue.draggable.next/issues/211#issuecomment-1718863764
Draggable.components = { ...Draggable.components, QList };

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const tracks = computed(() => store.state.tracks);
const tracksShouldPlay = computed(() => shouldPlay(tracks.value));
const setTrackPan = (trackId: TrackId, pan: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_PAN", { trackId, pan });
  } else {
    store.dispatch("SET_TRACK_PAN", { trackId, pan });
  }
};
const setTrackVolume = (trackId: TrackId, volume: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_VOLUME", { trackId, volume });
  } else {
    store.dispatch("SET_TRACK_VOLUME", { trackId, volume });
  }
};
const setTrackMute = (trackId: TrackId, mute: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_MUTE", { trackId, mute });
  } else {
    store.dispatch("SET_TRACK_MUTE", { trackId, mute });
  }
};
const setTrackSolo = (trackId: TrackId, solo: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_SOLO", { trackId, solo });
  } else {
    store.dispatch("SET_TRACK_SOLO", { trackId, solo });
  }
};

const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const trackCharacters = computed(() =>
  Object.fromEntries(
    tracks.value.map((track) => {
      if (!track.singer) return [track.id, undefined];
      for (const character of store.state.characterInfos[
        track.singer.engineId
      ]) {
        for (const style of character.metas.styles) {
          if (style.styleId === track.singer.styleId) {
            return [track.id, character];
          }
        }
      }
      return [track.id, undefined];
    })
  )
);
const selectTrack = (trackId: TrackId) => {
  store.dispatch("SET_SELECTED_TRACK", { trackId });
};
const createTrack = () => {
  const singer = selectedTrack.value.singer;
  if (!singer) return;
  store.dispatch("COMMAND_CREATE_TRACK", {
    singer,
  });
};
const deleteTrack = (trackId: TrackId) => {
  store.dispatch("COMMAND_DELETE_TRACK", { trackId });
};
const isDragging = ref(false);
const reorderTracks = (newTracks: Track[]) => {
  store.dispatch("COMMAND_REORDER_TRACKS", {
    trackIds: newTracks.map((track) => track.id),
  });
};
const trackStyles = computed(() =>
  Object.fromEntries(
    tracks.value.map((track) => {
      if (!track.singer) return [track.id, undefined];
      const character = trackCharacters.value[track.id];
      if (!character) return [track.id, undefined];
      for (const style of character.metas.styles) {
        if (style.styleId === track.singer.styleId) {
          return [track.id, style];
        }
      }
      return [track.id, undefined];
    })
  )
);
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
.track-detail-container {
  padding: 0;

  border-bottom: 1px solid colors.$sequencer-sub-divider;

  .dragging & {
    display: none;
  }
}
.track-detail {
  margin-left: 0.5rem;
  padding: 0 0.5rem;
  width: 100%;
  border-left: 1px solid colors.$sequencer-sub-divider;
  display: flex;
  flex-direction: column;

  .pan,
  .volume {
    display: grid;
    align-items: center;
    gap: 1rem;
    grid-template-columns: 1.5rem 1fr 1.5rem;

    .l,
    .r {
      justify-self: center;
    }
  }
}

.track-item {
  .track-handle {
    position: absolute;
    top: 0;
    left: 0;
    width: 4.5rem;
    height: 100%;
    cursor: grab;
    z-index: 1;
  }
  .track-control {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.1rem;

    .track-button-active {
      background-color: rgba(colors.$primary-rgb, 0.8);
    }
  }
}

.selected-item {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}
</style>
