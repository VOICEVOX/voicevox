<template>
  <div class="grid">
    <div class="sidebar">
      <BaseScrollArea>
        <div class="sidebar-inner">
          <slot name="sidebar" />
        </div>
      </BaseScrollArea>
    </div>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import BaseScrollArea from "./BaseScrollArea.vue";
</script>

<style lang="scss" scoped>
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

// TODO: MenuBar+Header分のマージン。Dialogコンポーネント置き換え後削除
.grid {
  height: calc(100vh - 90px);
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 100%;
  backdrop-filter: blur(32px);
  background-color: colors.$background-drawer;
  color: colors.$display;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  width: max-content;
}

.content {
  background-color: colors.$background;
  border-left: 1px solid colors.$border;
}
</style>
