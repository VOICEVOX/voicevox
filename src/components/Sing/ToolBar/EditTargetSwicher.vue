<template>
  <QBtnGroup flat class="edit-target-switcher">
    <!-- ノート -->
    <QBtn
      dense
      icon="piano"
      class="segment-switch"
      :class="{ active: editTarget === 'NOTE' }"
      @click="changeEditTarget('NOTE')"
    >
      <QTooltip :delay="500" anchor="bottom middle">ノート編集</QTooltip>
    </QBtn>

    <!-- ピッチ -->
    <QBtn
      dense
      icon="show_chart"
      class="segment-switch"
      :class="{ active: editTarget === 'PITCH' }"
      @click="changeEditTarget('PITCH')"
    >
      <QTooltip :delay="500" anchor="bottom middle"
        >ピッチ編集<br />Ctrl+クリックで消去</QTooltip
      >
    </QBtn>
  </QBtnGroup>
</template>

<script setup lang="ts">
import { SequencerEditTarget } from "@/store/type";

defineProps<{
  editTarget: SequencerEditTarget;
  changeEditTarget: (editTarget: SequencerEditTarget) => void;
}>();
</script>

<style scoped lang="scss">
.edit-target-switcher {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 6px;
}

.segment-switch {
  color: var(--md-sys-color-secondary-on-secondary-container);
  height: 40px;
  min-width: 40px;

  &.active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-secondary-on-secondary-container);
  }

  &:before {
    box-shadow: none;
  }
}
</style>
