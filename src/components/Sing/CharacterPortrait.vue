<template>
  <div v-if="showSingCharacterPortrait" class="clipping-container">
    <div class="character-portrait-wrap">
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
$portrait-min-height: 500px;

// 画像がはみ出ないようにクリップする
.clipping-container {
  position: relative;
  display: grid;
  overflow: hidden;
  pointer-events: none;
}

// 画面右下に固定表示
// 幅固定、高さ可変、画像のアスペクト比を保持、heightを調整
.character-portrait-wrap {
  display: flex;
  flex-direction: column;
  margin-left: auto;
  overflow: hidden;
}

// 通常は下部基準だが、親要素が最小高さより小さい場合は上部基準とし頭を残して足から隠れさせる
.character-portrait {
  display: block;
  margin-top: auto;
  min-height: max(75%, $portrait-min-height);
  opacity: 0.55;
  backface-visibility: hidden;
  object-fit: contain;
}
</style>
