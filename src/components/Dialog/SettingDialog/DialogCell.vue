<!-- 編集ダイアログが開く設定項目 -->

<template>
  <BaseCell :title :description>
    <div class="q-px-sm text-ellipsis">
      {{ props.currentValue }}
    </div>
    <QBtn
      :label="props.label || '編集する'"
      unelevated
      color="background"
      textColor="display"
      class="text-no-wrap q-mr-sm"
      @click="emit('click')"
    />
  </BaseCell>
</template>

<script setup lang="ts">
import BaseCell, { Props as BaseCellProps } from "./BaseCell.vue";

const props = defineProps<
  BaseCellProps & {
    currentValue: string;
    label?: string;
    disable?: boolean;
  }
>();

const emit = defineEmits<{
  click: [];
}>();
</script>
