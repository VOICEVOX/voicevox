<template>
  <QBtnGroup flat class="edit-target-switcher">
    <!-- ノート -->
    <QBtn
      dense
      unelevated
      class="segment-switch"
      :class="{ active: editTarget === 'NOTE' }"
      @click="changeEditTarget('NOTE')"
    >
      <QIcon name="piano" size="24px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transition-show=""
        transition-hide=""
      >
        ノート編集
      </QTooltip>
    </QBtn>

    <!-- ピッチ -->
    <QBtn
      dense
      unelevated
      class="segment-switch"
      :class="{ active: editTarget === 'PITCH' }"
      @click="changeEditTarget('PITCH')"
    >
      <QIcon name="timeline" size="24px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transition-show=""
        transition-hide=""
      >
        ピッチ編集<br />Ctrl+クリックで消去
      </QTooltip>
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
  border-radius: 4px;
}

.segment-switch {
  color: var(--md-sys-color-on-surface-variant);
  height: 40px;
  min-width: 40px;

  &.active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-primary);
  }
}
</style>
