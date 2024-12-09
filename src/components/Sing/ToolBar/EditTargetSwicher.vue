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
      <QIcon name="piano" size="20px" />
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
      <QIcon name="timeline" size="20px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transitionShow=""
        transitionHide=""
      >
        ピッチ編集<br />{{ !isMac ? "Ctrl" : "Cmd" }}+クリックで消去
      </QTooltip>
    </QBtn>
  </QBtnGroup>
</template>

<script setup lang="ts">
import { SequencerEditTarget } from "@/store/type";
import { isMac } from "@/helpers/platform";

defineProps<{
  editTarget: SequencerEditTarget;
  changeEditTarget: (editTarget: SequencerEditTarget) => void;
}>();
</script>

<style scoped lang="scss">
.edit-target-switcher {
  border: 1px solid var(--scheme-color-outline-variant);
  box-sizing: border-box;
  padding: 3px;
  height: 40px;
  border-radius: 20px;
}

.segment-switch {
  color: var(--scheme-color-on-surface-variant);
  height: 32px;
  min-width: 32px;
  border-radius: 16px !important;

  &.active {
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
  }
}
</style>
