<template>
  <div class="character-portrait-wrap" :class="{ hide: !isShowSinger }">
    <img class="character-portrait" :src="portraitPath" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "CharacterPortrait",
  setup() {
    const store = useStore();
    const isShowSinger = computed(() => store.state.isShowSinger);

    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );

    const characterInfo = computed(() => {
      if (!userOrderedCharacterInfos.value || !store.state.singer) {
        return undefined;
      }
      return store.getters.CHARACTER_INFO(
        store.state.singer.engineId,
        store.state.singer.styleId
      );
    });

    const portraitPath = computed(() => characterInfo.value?.portraitPath);

    return {
      isShowSinger,
      userOrderedCharacterInfos,
      characterInfo,
      portraitPath,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

// 画面右下に固定表示
// 幅固定、高さ可変、画像のアスペクト比を保持、wrapのwidthに合わせてheightを調整
// bottom位置はスクロールバーの上に表示
.character-portrait-wrap {
  opacity: 0.55;
  overflow: hidden;
  contain: layout;
  pointer-events: none;
  position: fixed;
  bottom: 0;
  right: 88px;
  min-width: 200px;
  max-width: 20vw;
}

.character-portrait {
  width: 100%;
  height: auto;
  backface-visibility: hidden;
}
</style>
