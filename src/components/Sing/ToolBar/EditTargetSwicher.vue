<template>
  <QBtnGroup flat class="edit-target-switcher">
    <!-- ノート -->
    <QBtn
      dense
      unelevated
      class="segment-switch"
      :class="{ active: editTarget === 'NOTE' }"
      @click="changeEditTarget('NOTE')"
      @keydown="handleKeyDown"
    >
      <QIcon name="piano" size="24px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transitionShow=""
        transitionHide=""
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
        transitionShow=""
        transitionSide=""
      >
        ピッチ編集<br />{{ !isMac ? "Ctrl" : "Cmd" }}+クリックで消去
      </QTooltip>
    </QBtn>
  </QBtnGroup>
</template>

<script setup lang="ts">
import { SequencerEditTarget } from "@/store/type";
import { isMac } from "@/type/preload";

defineProps<{
  editTarget: SequencerEditTarget;
  changeEditTarget: (editTarget: SequencerEditTarget) => void;
}>();
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
  }
};
</script>

<style scoped lang="scss">
.edit-target-switcher {
  background: var(--scheme-color-surface-container-low);
  border-radius: 28px;
  padding: 4px;
}

.segment-switch {
  color: var(--scheme-color-on-surface-variant);
  height: 40px;
  min-width: 40px;
  border-radius: 20px !important;

  &.active {
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-primary);
  }
}
</style>
