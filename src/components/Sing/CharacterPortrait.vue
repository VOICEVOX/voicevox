<template>
  <div v-if="showSingCharacterPortrait" class="character-portrait-wrap">
    <img class="character-portrait" :src="portraitPath" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";

const store = useStore();
const showSingCharacterPortrait = computed(
  () => store.state.showSingCharacterPortrait,
);

const portraitPath = computed(() => {
  const userOrderedCharacterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
  const singer = store.getters.SELECTED_TRACK.singer;
  if (!userOrderedCharacterInfos || !singer) {
    return undefined;
  }
  const characterInfo = store.getters.CHARACTER_INFO(
    singer.engineId,
    singer.styleId,
  );
  const styleInfo = characterInfo?.metas.styles.find(
    (style) => style.styleId === singer.styleId,
  );
  return styleInfo?.portraitPath || characterInfo?.portraitPath;
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

// 表示変数
$right-margin: 24px;
$portrait-min-width: 200px;
$portrait-max-width: 40vw;
$portrait-min-height: 500px;
$portrait-max-height: 60vh;

// 画面右下に固定表示
// 幅固定、高さ可変、画像のアスペクト比を保持、heightを調整
.character-portrait-wrap {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  position: sticky;
  bottom: 0;
  right: $right-margin;
  height: 100%;
  contain: strict;
  pointer-events: none;
}

// 通常は下部基準だが、親要素が最小高さより小さい場合は上部基準とし頭を残して足から隠れさせる
.character-portrait {
  position: absolute;
  // 通常は下部基準
  bottom: 0;
  // 親要素が最小高さより小さい場合は上部基準
  top: max(0px, calc(100% - $portrait-min-height));
  min-width: $portrait-min-width;
  max-width: $portrait-max-width;
  min-height: $portrait-min-height;
  max-height: $portrait-max-height;
  opacity: 0.55;
  backface-visibility: hidden;
  object-fit: contain;
  transform-origin: top;
}
</style>
