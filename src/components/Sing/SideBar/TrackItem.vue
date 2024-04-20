<template>
  <QItem
    v-ripple
    clickable
    class="track-item"
    active-class="selected-track"
    :active="props.track.id === selectedTrack.id"
    :disable="uiLocked"
    @click="selectTrack(props.track.id)"
  >
    <ContextMenu
      :menudata="[
        {
          type: 'button',
          label: '削除',
          onClick: () => deleteTrack(props.track.id),
          disableWhenUiLocked: true,
        },
      ]"
    />
    <div class="track-handle track-handle-bg" />
    <QIcon
      v-if="props.track.id === selectedTrack.id"
      name="arrow_right"
      color="primary"
      size="md"
      class="active-arrow"
    />
    <QItemSection
      avatar
      class="singer-icon-container track-handle"
      @click.stop=""
    >
      <SingerIcon
        v-if="trackStyles[props.track.id]"
        round
        class="singer-icon"
        size="3rem"
        :style="trackStyles[props.track.id]!"
      />
      <QAvatar v-else round size="3rem" color="primary"
        ><span color="text-display-on-primary">?</span></QAvatar
      >
      <CharacterSelectMenu :track-id="props.track.id" />
    </QItemSection>
    <QItemSection>
      <QItemLabel class="singer-name" @click.stop>
        <QInput v-model="temporaryTrackName" dense @blur="updateTrackName" />
      </QItemLabel>
      <QItemLabel
        v-if="trackStyles[props.track.id]"
        caption
        class="singer-style"
      >
        {{ singerName }}
      </QItemLabel>
    </QItemSection>
    <div side class="track-control">
      <QBtn
        color="default"
        icon="volume_off"
        round
        outline
        dense
        size="sm"
        class="track-button"
        :class="{ 'track-button-active': props.track.mute }"
        :disable="uiLocked || isThereSoloTrack"
        @click.stop="setTrackMute(!props.track.mute)"
      >
        <QTooltip>ミュート</QTooltip>
      </QBtn>
      <QBtn
        color="default"
        icon="headset"
        rounded
        outline
        dense
        size="sm"
        class="track-button"
        :class="{ 'track-button-active': props.track.solo }"
        :disable="uiLocked"
        @click.stop="setTrackSolo(!props.track.solo)"
      >
        <QTooltip>ソロ</QTooltip>
      </QBtn>
    </div>
  </QItem>

  <QItem
    v-if="!isDragging && props.track.id === selectedTrack.id"
    class="track-detail-container"
  >
    <div class="track-detail">
      <div class="pan">
        <div class="l">L</div>
        <QSlider
          :model-value="props.track.pan"
          :min="-1"
          :max="1"
          :step="0.1"
          :markers="1"
          selection-color="transparent"
          :disable="uiLocked"
          @change="setTrackPan($event)"
          @dblclick="setTrackPan(0)"
        />
        <div class="r">R</div>
      </div>
      <div class="volume">
        <QIcon name="volume_down" class="l" size="1rem" />
        <QSlider
          :model-value="props.track.volume"
          :min="0"
          :max="2"
          :step="0.1"
          :markers="1"
          :disable="uiLocked"
          @change="setTrackVolume($event)"
          @dblclick="setTrackVolume(1)"
        />
        <QIcon name="volume_up" class="r" size="1rem" />
      </div>
    </div>
  </QItem>
</template>
<script setup lang="ts">
import { computed, watch, ref } from "vue";
import Draggable from "vuedraggable";
import { QList } from "quasar";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import { useStore } from "@/store";
import { Track } from "@/store/type";
import { TrackId } from "@/type/preload";
import ContextMenu from "@/components/Menu/ContextMenu.vue";

// https://github.com/SortableJS/vue.draggable.next/issues/211#issuecomment-1718863764
Draggable.components = { ...Draggable.components, QList };

const props = defineProps<{
  track: Track;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const tracks = computed(() => store.state.tracks);
const isThereSoloTrack = computed(() =>
  tracks.value.some((track) => track.solo),
);

const setTrackPan = (pan: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_PAN", { trackId: props.track.id, pan });
  } else {
    store.dispatch("SET_TRACK_PAN", { trackId: props.track.id, pan });
  }
};

const setTrackVolume = (volume: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_VOLUME", {
      trackId: props.track.id,
      volume,
    });
  } else {
    store.dispatch("SET_TRACK_VOLUME", { trackId: props.track.id, volume });
  }
};

watch(
  () => props.track.name,
  () => {
    temporaryTrackName.value = props.track.name;
  },
);
const temporaryTrackName = ref(props.track.name);
const updateTrackName = () => {
  if (temporaryTrackName.value === props.track.name) return;
  if (temporaryTrackName.value === "") {
    temporaryTrackName.value = props.track.name;
    return;
  }
  setTrackName(temporaryTrackName.value);
};
const setTrackName = (name: string) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_NAME", { trackId: props.track.id, name });
  } else {
    store.dispatch("SET_TRACK_NAME", { trackId: props.track.id, name });
  }
};

const setTrackMute = (mute: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_MUTE", { trackId: props.track.id, mute });
  } else {
    store.dispatch("SET_TRACK_MUTE", { trackId: props.track.id, mute });
  }
};

const setTrackSolo = (solo: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_SOLO", { trackId: props.track.id, solo });
  } else {
    store.dispatch("SET_TRACK_SOLO", { trackId: props.track.id, solo });
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
    }),
  ),
);
const selectTrack = (trackId: TrackId) => {
  store.dispatch("SET_SELECTED_TRACK", { trackId });
};

const deleteTrack = (trackId: TrackId) => {
  store.dispatch("COMMAND_DELETE_TRACK", { trackId });
};

const isDragging = ref(false);

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
    }),
  ),
);

const singerName = computed(() => {
  const character = trackCharacters.value[props.track.id];
  if (!character) return "（不明なキャラクター）";
  return character.metas.speakerName;
});
</script>
<style scoped lang="scss">
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.track-detail-container {
  padding: 0;

  border-bottom: 1px solid colors.$sequencer-sub-divider;

  .dragging & {
    display: none;
  }
}

.track-detail {
  margin-left: 0.5rem;
  padding: 0 0.5rem 0.25rem 0.5rem;
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
  &.selected-track {
    color: colors.$display;
  }

  .track-handle-bg {
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
    gap: 0.25rem;
    z-index: 2;

    .track-button {
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;

      &:not(.track-button-active)::before {
        border-color: rgba(colors.$display-rgb, 0.5);
      }
      &.track-button-active {
        &::before {
          border-width: 2px;
        }
        color: colors.$primary;

        :deep(i) {
          color: colors.$display;
        }
      }
    }
  }
}

.active-arrow {
  position: absolute;
  left: -0.5rem;
  top: 50%;
  transform: translateY(-50%);
}

.singer-icon-container {
  z-index: 2;
  position: relative;
}

.singer-name :deep(.q-field__control) {
  height: 1.5rem;
}

.singer-name,
.singer-style {
  width: calc(100% - 3.5rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
