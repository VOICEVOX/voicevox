<template>
  <div class="full-width full-height">
    <span class="character-name">{{ characterName }}</span>
    <img
      :src="portraitBlobUrl"
      class="full-width full-height character-portrait"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { ACTIVE_AUDIO_KEY } from "@/store/audio";

export default defineComponent({
  name: "CharacterPortrait",

  setup() {
    const store = useStore();

    const characterInfo = computed(() => {
      const characterInfos = store.state.characterInfos || [];
      const activeAudioKey: string | undefined =
        store.getters[ACTIVE_AUDIO_KEY];
      const audioItem = activeAudioKey
        ? store.state.audioItems[activeAudioKey]
        : undefined;
      const characterIndex = audioItem?.characterIndex;

      return characterIndex !== undefined
        ? characterInfos[characterIndex]
        : undefined;
    });

    const characterName = computed(() => characterInfo.value?.metas.name);

    const portraitBlobUrl = computed(() => {
      const portraitBlob = characterInfo.value?.portraitBlob;

      return portraitBlob ? URL.createObjectURL(portraitBlob) : undefined;
    });

    return {
      characterName,
      portraitBlobUrl,
    };
  },
});
</script>

<style lang="scss" scoped>
.character-name {
  position: absolute;
  padding: 1px 24px 1px 8px;
  background-image: linear-gradient(
    90deg,
    rgba(white, 0.5) 0%,
    rgba(white, 0.5) 75%,
    transparent 100%
  );
}

.character-portrait {
  object-fit: none;
  object-position: center top;
}
</style>
