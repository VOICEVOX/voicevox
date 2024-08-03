<template>
  <QBtn flat class="q-pa-none" :disable="uiLocked" noCaps>
    <SelectedCharacter :showSkeleton :selectedCharacterInfo :selectedSinger />
    <CharacterSelectMenu :trackId="selectedTrackId" />
  </QBtn>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SelectedCharacter from "./SelectedCharacter.vue";
import CharacterSelectMenu from "./CharacterSelectMenu.vue";
import { useStore } from "@/store";

defineOptions({
  name: "CharacterMenuButton",
});

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);

const showSkeleton = computed(() => selectedCharacterInfo.value == undefined);

const userOrderedCharacterInfos = computed(() => {
  return store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
});

const selectedCharacterInfo = computed(() => {
  const singer = store.getters.SELECTED_TRACK.singer;
  if (userOrderedCharacterInfos.value == undefined || !singer) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(singer.engineId, singer.styleId);
});

const selectedSinger = computed(() => {
  return store.getters.SELECTED_TRACK.singer;
});
</script>
