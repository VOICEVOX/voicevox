<!-- 
  ノートやピッチなどの編集対象を切り替えるボタン
-->

<template>
  <!-- ノート -->
  <QBtn
    dense
    icon="piano"
    :color="editTarget === 'NOTE' ? 'primary' : undefined"
    :text-color="editTarget === 'NOTE' ? 'display' : undefined"
    @click="editTarget !== 'NOTE' && changeEditTarget('NOTE')"
    ><QTooltip :delay="500" anchor="bottom middle">ノート編集</QTooltip></QBtn
  >

  <!-- ピッチ -->
  <QBtn
    dense
    icon="show_chart"
    :color="editTarget === 'PITCH' ? 'primary' : undefined"
    :text-color="editTarget === 'PITCH' ? 'display' : undefined"
    class="margin-right"
    @click="editTarget !== 'PITCH' && changeEditTarget('PITCH')"
    ><QTooltip :delay="500" anchor="bottom middle"
      >ピッチ編集<br />Ctrl+クリックで消去</QTooltip
    ></QBtn
  >
</template>

<script setup lang="ts">
import { SequencerEditTarget } from "@/store/type";

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
