<!-- 
  ノートやピッチなどの編集対象を切り替えるボタン
-->

<template>
  <!-- ノート -->
  <QBtnToggle
    dense
    :model-value="editTarget"
    toggle-text-color="display"
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
    @update:model-value="changeEditTarget"
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

<style scoped lang="scss">
.margin-right {
  margin-right: 6px;
}
</style>
