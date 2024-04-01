<template>
  <div class="sidebar">
    <QList class="tracks">
      <QItemLabel header>トラック一覧</QItemLabel>
      <QItem
        v-for="(track, i) in tracks"
        :key="i"
        v-ripple
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
      <QItem v-ripple clickable @click="createTrack">
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
import { base64ImageToUri } from "@/helpers/imageHelper";
import { getStyleDescription } from "@/sing/viewHelper";

const store = useStore();

const tracks = computed(() => store.state.tracks);
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

.selected-item {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}
</style>
