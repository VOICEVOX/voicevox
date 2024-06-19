<!--
  ノートやピッチなどの編集対象を切り替えるボタン
-->

<template>
  <QBtnToggle
    dense
    unelevated
    toggleColor="primary"
    :modelValue="editTarget"
    toggleTextColor="display-on-primary"
    class="edit-target-switcher q-mr-sm"
    :options="[
      {
        icon: 'piano',
        value: 'NOTE',
        slot: 'NOTE',
      },
      {
        icon: 'show_chart',
        value: 'PITCH',
        slot: 'PITCH',
      },
    ]"
    @update:modelValue="changeEditTarget"
    ><template #NOTE
      ><QTooltip :delay="500" anchor="bottom middle">ノート編集</QTooltip>
    </template>
    <template #PITCH>
      <QTooltip :delay="500" anchor="bottom middle"
        >ピッチ編集<br />{{ !isMac ? "Ctrl" : "Cmd" }}+クリックで消去</QTooltip
      >
    </template>
  </QBtnToggle>
</template>

<script setup lang="ts">
import { SequencerEditTarget } from "@/store/type";
import { isMac } from "@/type/preload";

defineProps<{
  editTarget: SequencerEditTarget;
  changeEditTarget: (editTarget: SequencerEditTarget) => void;
}>();
</script>

<style lang="scss" scoped>
.edit-target-switcher :deep(.q-btn-item) {
  position: relative;

  &.bg-primary {
    // borderがないと切り換え時に1px動くのでそれを防ぐ
    border: 1px solid var(--color-primary);
  }
  &:not(.bg-primary) {
    border: 1px solid rgba(var(--color-display-rgb), 0.3);
    &:first-child {
      border-right: 0;
    }
    &:last-child {
      border-left: 0;
    }
  }
}
</style>
