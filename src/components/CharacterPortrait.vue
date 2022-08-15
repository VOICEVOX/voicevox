<template>
  <div class="character-portrait-wrapper">
    <span class="character-name">{{ characterName }}</span>
    <img :src="portraitPath" class="character-portrait" />
    <div v-if="isInitializingSpeaker" class="loading">
      <q-spinner color="primary" size="5rem" :thickness="4" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "CharacterPortrait",

  setup() {
    const store = useStore();

    const characterInfo = computed(() => {
      const activeAudioKey: string | undefined = store.getters.ACTIVE_AUDIO_KEY;
      const audioItem = activeAudioKey
        ? store.state.audioItems[activeAudioKey]
        : undefined;

      const engineId = audioItem?.engineId;
      const styleId = audioItem?.styleId;

      if (engineId === undefined || styleId === undefined) return undefined;

      return store.getters.CHARACTER_INFO(engineId, styleId);
    });

    const characterName = computed(() => {
      const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
      const audioItem = activeAudioKey
        ? store.state.audioItems[activeAudioKey]
        : undefined;
      const styleId = audioItem?.styleId;
      const style = characterInfo.value?.metas.styles.find(
        (style) => style.styleId === styleId
      );
      return style?.styleName
        ? `${characterInfo.value?.metas.speakerName} (${style?.styleName})`
        : characterInfo.value?.metas.speakerName;
    });

    const portraitPath = computed(() => characterInfo.value?.portraitPath);

    const isInitializingSpeaker = computed(() => {
      const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
      return store.state.audioKeyInitializingSpeaker === activeAudioKey;
    });

    return {
      characterName,
      portraitPath,
      isInitializingSpeaker,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

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
