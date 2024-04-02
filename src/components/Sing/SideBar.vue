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
                :model-value="trackPan"
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
                :model-value="trackVolume"
                :min="0"
                :max="1.5"
                :step="0.1"
                :markers="1"
                @change="setTrackVolume(i, $event)"
                @dblclick="setTrackVolume(i, 1)"
              />
              <QIcon name="volume_up" class="r" size="1rem" />
            </div>
            <div class="buttons">
              <QBtn
                color="display"
                icon="delete"
                round
                flat
                dense
                size="sm"
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
          <QItemSection avatar>
            <SingerIcon
              v-if="trackStyles[i]"
              round
              size="3rem"
              :style="trackStyles[i]!"
              :is-multiple-engine="isMultipleEngine"
              :engine-icons="engineIcons"
            />
            <QAvatar v-else round size="3rem" color="primary"
              ><span color="text-display-on-primary">?</span></QAvatar
            >
          </QItemSection>

          <QItemSection>
            <QItemLabel>
              {{
              trackCharacters[i]
                ? trackCharacters[i]!.metas.speakerName
                : "（不明なキャラクター）"
              }}
            </QItemLabel>
            <QItemLabel caption>
              {{ trackStyles[i] ? getStyleDescription(trackStyles[i]!) : "" }}
            </QItemLabel>
          </QItemSection>
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
import { base64ImageToUri } from "@/helpers/imageHelper";
import { getStyleDescription } from "@/sing/viewHelper";

const store = useStore();

const tracks = computed(() => store.state.tracks);
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
const trackPan = computed(() => selectedTrack.value.pan);
const setTrackPan = (index: number, pan: number) => {
  store.dispatch("COMMAND_SET_TRACK_PAN", { trackIndex: index, pan });
};
const setTrackVolume = (index: number, volume: number) => {
  store.dispatch("COMMAND_SET_TRACK_VOLUME", { trackIndex: index, volume });
};

const trackVolume = computed(() => selectedTrack.value.volume);

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
const engineIcons = computed(() =>
  Object.fromEntries(
    store.state.engineIds.map((engineId) => [
      engineId,
      base64ImageToUri(store.state.engineManifests[engineId].icon),
    ])
  )
);
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
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
}
.track-detail-container {
  padding: 0;

  border-bottom: 1px solid colors.$sequencer-sub-divider;
}
.track-detail {
  margin-left: 0.5rem;
  padding: 0.5rem;
  padding-top: 0;
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

.selected-item {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}
</style>
