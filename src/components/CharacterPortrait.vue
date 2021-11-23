<template>
  <div class="character-portrait-wrapper">
    <span class="character-name">{{ characterName }}</span>
    <img
      v-if="portraitBase64"
      :src="'data:image/png;base64,' + portraitBase64"
      class="character-portrait"
    />
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
      const characterInfos = store.state.characterInfos || [];
      const activeAudioKey: string | undefined = store.getters.ACTIVE_AUDIO_KEY;
      const audioItem = activeAudioKey
        ? store.state.audioItems[activeAudioKey]
        : undefined;
      const styleId = audioItem?.styleId;

      return styleId !== undefined
        ? characterInfos.find((info) =>
            info.metas.styles.find((style) => style.styleId === styleId)
          )
        : undefined;
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

    const portraitBase64 = computed(() => characterInfo.value?.portraitBase64);

    return {
      characterName,
      portraitBase64,
    };
  },
});
</script>

<style lang="scss" scoped>
$background: var(--color-background-rgb);

.character-name {
  position: absolute;
  padding: 1px 24px 1px 8px;
  background-image: linear-gradient(
    90deg,
    rgba($background, 0.5) 0%,
    rgba($background, 0.5) 75%,
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
}
</style>
