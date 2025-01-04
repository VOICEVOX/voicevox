<template>
  <div v-if="showSingCharacterPortrait" class="clipping-container">
    <div class="character-portrait-wrap">
      <div class="spacer"></div>
      <img class="character-portrait" :src="portraitPath" />
    </div>
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
$spacer-height: 200px;

// 画像がはみ出ないようにクリップする
.clipping-container {
  position: relative;
  overflow: hidden;
}

// 画面右下に固定表示
// 幅固定、高さ可変、画像のアスペクト比を保持、heightを調整
.character-portrait-wrap {
  position: relative;
  height: max(100%, $portrait-min-height);
  margin-right: $right-margin;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  pointer-events: none;
}

.spacer {
  flex: 0 1 $spacer-height;
  width: 1px;
}

.character-portrait {
  flex: 1 0;
  min-width: $portrait-min-width;
  max-width: $portrait-max-width;
  min-height: $portrait-min-height;
  max-height: $portrait-max-height;
  opacity: 0.55;
  backface-visibility: hidden;
  object-fit: contain;
  object-position: bottom center;
}
</style>
