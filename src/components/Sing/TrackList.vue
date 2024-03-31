<template>
  <div class="sidebar">
    <QList class="tracks">
      <QItem class=""> A </QItem>
    </QList>
  </div>
</template>
<script setup lang="ts"></script>
<style scoped lang="scss">
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;
.sidebar {
  width: vars.$sidebar-width;
  height: 100%;
  background-color: colors.$background;
  display: flex;
  border-top: 1px solid colors.$sequencer-sub-divider;
  border-right: 1px solid colors.$sequencer-main-divider;
}
.tracks {
  width: 100%;
}
</style>
