<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div class="parameter-area">音素タイミング編集</div>
  </div>
</template>

<style scoped lang="scss">
.phoneme-timing-editor {
  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-columns: 48px 1fr;
}

.axis-area {
  grid-column: 1;
  grid-row: 1;
  border-right: solid 1px var(--scheme-color-sing-piano-keys-right-border);
}

.parameter-area {
  grid-column: 2;
  grid-row: 1;

  overflow: hidden;
}
</style>
