<template>
  <div class="character-portrait-wrap" :class="{ hide: !isShowSinger }">
    <img class="character-portrait" :src="portraitPath" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";

const store = useStore();
const isShowSinger = computed(() => store.state.isShowSinger);

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
$header-margin: vars.$toolbar-height + vars.$menubar-height + 30px; // 30pxはルーラーの高さ
$right-margin: 24px;
$portrait-max-width: 40vw;
$portrait-max-height: 60vh;
$portrait-min-height: 500px;

// 画面右下に固定表示
// 幅固定、高さ可変、画像のアスペクト比を保持、wrapのwidthに合わせてheightを調整
// bottom位置はスクロールバーの上に表示
.character-portrait-wrap {
  opacity: 0.55;
  overflow: visible;
  contain: layout;
  pointer-events: none;
  position: fixed;
  display: grid;
  place-items: end;
  bottom: 0;
  right: $right-margin;
}

.character-portrait {
  width: auto;
  height: $portrait-max-height;
  min-height: $portrait-min-height;
  max-width: $portrait-max-width;
  overflow: visible;
  backface-visibility: hidden;
  object-fit: cover;
  object-position: top center;
}

// ポートレートサイズが画面サイズを超えた場合、ヘッダーを考慮してポートレートを上部基準で表示させる
// ヘッダー高さ120px+ポートレート高さ500pxだとする
@media (max-height: #{calc(#{$portrait-min-height} + #{$header-margin})}) {
  .character-portrait-wrap {
    top: $header-margin; // ヘッダーの高さより下に位置させる
    bottom: auto;
    height: calc(100vh - #{$header-margin});
    place-items: start end;
  }
}
</style>
