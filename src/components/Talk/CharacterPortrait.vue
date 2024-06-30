<template>
  <div class="character-portrait-wrapper">
    <span class="character-name">{{ characterName }}</span>
    <span v-if="isMultipleEngine" class="character-engine-name">{{
      engineName
    }}</span>
    <img :src="portraitPath" class="character-portrait" :alt="characterName" />
    <div v-if="isInitializingSpeaker" class="loading">
      <QSpinner color="primary" size="5rem" :thickness="4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { AudioKey } from "@/type/preload";
import { formatCharacterStyleName } from "@/store/utility";

const store = useStore();

const characterInfo = computed(() => {
  const activeAudioKey: AudioKey | undefined = store.getters.ACTIVE_AUDIO_KEY;
  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;

  const engineId = audioItem?.voice.engineId;
  const styleId = audioItem?.voice.styleId;

  if (
    engineId == undefined ||
    styleId == undefined ||
    !store.state.engineIds.some((id) => id === engineId)
  )
    return undefined;

  return store.getters.CHARACTER_INFO(engineId, styleId);
});

const styleInfo = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;

  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;

  const styleId = audioItem?.voice.styleId;
  const style = characterInfo.value?.metas.styles.find(
    (style) => style.styleId === styleId,
  );
  return style;
});

const characterName = computed(() => {
  // 初期化前・未選択時
  if (characterInfo.value == undefined) {
    return "（表示エラー）";
  }

  const speakerName = characterInfo.value.metas.speakerName;
  const styleName = styleInfo.value?.styleName;
  return styleName
    ? formatCharacterStyleName(speakerName, styleName)
    : speakerName;
});

const engineName = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;
  const engineId = audioItem?.voice.engineId ?? store.state.engineIds[0];
  const engineManifest = store.state.engineManifests[engineId];
  const engineInfo = store.state.engineInfos[engineId];
  return engineManifest ? engineManifest.brandName : engineInfo.name;
});

const portraitPath = computed(
  () => styleInfo.value?.portraitPath || characterInfo.value?.portraitPath,
);

const isInitializingSpeaker = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  return (
    activeAudioKey &&
    store.state.audioKeysWithInitializingSpeaker.includes(activeAudioKey)
  );
});

const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.character-name {
  position: absolute;
  padding: 1px 24px 1px 8px;
  background-image: linear-gradient(
    90deg,
    rgba(colors.$background-rgb, 0.5) 0%,
    rgba(colors.$background-rgb, 0.5) 75%,
    transparent 100%
  );
  overflow-wrap: anywhere;
}

.character-engine-name {
  position: absolute;
  padding: 1px 24px 1px 8px;
  background-image: linear-gradient(
    90deg,
    rgba(colors.$background-rgb, 0.5) 0%,
    rgba(colors.$background-rgb, 0.5) 75%,
    transparent 100%
  );
  bottom: 0;
  overflow-wrap: anywhere;
}

.character-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .character-portrait {
    margin: auto;
  }
  .loading {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: rgba(colors.$background-rgb, 0.3);
    display: grid;
    justify-content: center;
    align-content: center;
  }
}
</style>
