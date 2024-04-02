<template>
  <div class="sidebar">
    <QList class="tracks">
      <QItemLabel header>トラック一覧</QItemLabel>
      <template v-for="[track, i] in trackListItems">
        <QItem
          v-if="track === 'trackDetail'"
          :key="`detail-${i}`"
          class="track-detail-container"
        >
          <div class="track-detail">
            <div class="pan">
              <div class="l">L</div>
              <QSlider
                :model-value="tracks[i].pan"
                :min="-1"
                :max="1"
                :step="0.1"
                :markers="1"
                selection-color="transparent"
                @change="setTrackPan(i, $event)"
                @dblclick="setTrackPan(i, 0)"
              />
              <div class="r">R</div>
            </div>
            <div class="volume">
              <QIcon name="volume_down" class="l" size="1rem" />
              <QSlider
                :model-value="tracks[i].volume"
                :min="0"
                :max="2"
                :step="0.1"
                :markers="1"
                @change="setTrackVolume(i, $event)"
                @dblclick="setTrackVolume(i, 1)"
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
                :disable="tracks.length === 1"
                @click="
                  store.dispatch('COMMAND_DELETE_TRACK', { trackIndex: i })
                "
              />
            </div>
          </div>
        </QItem>
        <QItem
          v-else
          :key="i"
          v-ripple
          class="track-item"
          clickable
          :active="selectedTrackIndex === i"
          active-class="selected-item"
          @click="selectTrack(i)"
        >
          <QItemSection
            avatar
            :style="{
              opacity: tracksShouldPlay[i] ? 1 : 0.5,
            }"
          >
            <SingerIcon
              v-if="trackStyles[i]"
              round
              size="3rem"
              :style="trackStyles[i]!"
            />
            <QAvatar v-else round size="3rem" color="primary"
              ><span color="text-display-on-primary">?</span></QAvatar
            >
          </QItemSection>

          <QItemSection>
            <QItemLabel>
              {{
                nullableToDefault(
                  "（不明なキャラクター）",

                  mapNullablePipe(
                    trackCharacters[i],
                    (trackCharacter) => trackCharacter.metas.speakerName
                  )
                )
              }}
            </QItemLabel>
            <QItemLabel v-if="trackStyles[i]" caption>
              {{ mapNullablePipe(trackStyles[i], getStyleDescription) }}
            </QItemLabel>
          </QItemSection>
          <div side class="track-control">
            <QBtn
              color="default"
              :icon="tracks[i].mute ? 'volume_off' : 'volume_up'"
              round
              flat
              dense
              size="sm"
              :class="{ 'track-button-active': tracks[i].mute }"
              @click.stop="setTrackMute(i, !tracks[i].mute)"
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
              :class="{ 'track-button-active': tracks[i].solo }"
              @click.stop="setTrackSolo(i, !tracks[i].solo)"
            >
              <QTooltip>ソロ</QTooltip>
            </QBtn>
          </div>
        </QItem>
      </template>
      <QItem v-ripple class="create-track-item" clickable @click="createTrack">
        <QItemSection avatar>
          <QIcon color="display" name="add" />
        </QItemSection>
        <QItemSection>
          <QItemLabel>トラックを追加</QItemLabel>
        </QItemSection>
      </QItem>
    </QList>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import SingerIcon from "./SingerIcon.vue";
import { useStore } from "@/store";
import { Track } from "@/store/type";
import { getStyleDescription } from "@/sing/viewHelper";
import { mapNullablePipe } from "@/helpers/map";
import { shouldPlay } from "@/sing/domain";
import { nullableToDefault } from "@/helpers/map";

const store = useStore();

const tracks = computed(() => store.state.tracks);
const tracksShouldPlay = computed(() => shouldPlay(tracks.value));
const trackListItems = computed<["trackDetail" | Track, number][]>(() => {
  const items: ["trackDetail" | Track, number][] = tracks.value.map(
    (track, i) => [track, i]
  );
  items.splice(selectedTrackIndex.value + 1, 0, [
    "trackDetail",
    selectedTrackIndex.value,
  ]);

  return items;
});
const setTrackPan = (index: number, pan: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_PAN", { trackIndex: index, pan });
  } else {
    store.dispatch("SET_TRACK_PAN", { trackIndex: index, pan });
  }
};
const setTrackVolume = (index: number, volume: number) => {
  if (["panVolume", "all"].includes(store.state.songUndoableTrackControl)) {
    store.dispatch("COMMAND_SET_TRACK_VOLUME", { trackIndex: index, volume });
  } else {
    store.dispatch("SET_TRACK_VOLUME", { trackIndex: index, volume });
  }
};
const setTrackMute = (index: number, mute: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_MUTE", { trackIndex: index, mute });
  } else {
    store.dispatch("SET_TRACK_MUTE", { trackIndex: index, mute });
  }
};
const setTrackSolo = (index: number, solo: boolean) => {
  if (store.state.songUndoableTrackControl === "all") {
    store.dispatch("COMMAND_SET_TRACK_SOLO", { trackIndex: index, solo });
  } else {
    store.dispatch("SET_TRACK_SOLO", { trackIndex: index, solo });
  }
};

const selectedTrackIndex = computed(() => store.state.selectedTrackIndex);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const trackCharacters = computed(() =>
  tracks.value.map((track) => {
    if (!track.singer) return undefined;
    for (const character of store.state.characterInfos[track.singer.engineId]) {
      for (const style of character.metas.styles) {
        if (style.styleId === track.singer.styleId) {
          return character;
        }
      }
    }
  })
);
const selectTrack = (index: number) => {
  store.dispatch("SET_SELECTED_TRACK_INDEX", { trackIndex: index });
};
const createTrack = () => {
  const singer = selectedTrack.value.singer;
  if (!singer) return;
  store.dispatch("COMMAND_CREATE_TRACK", {
    singer,
  });
};
const trackStyles = computed(() =>
  tracks.value.map((track, i) => {
    if (!track.singer) return undefined;
    const character = trackCharacters.value[i];
    if (!character) return undefined;
    for (const style of character.metas.styles) {
      if (style.styleId === track.singer.styleId) {
        return style;
      }
    }
  })
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
}
.track-detail {
  // margin-left: 0.5rem;
  padding: 0 0.5rem;
  width: 100%;
  // border-left: 1px solid colors.$sequencer-sub-divider;
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

.selected-item {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}
</style>
