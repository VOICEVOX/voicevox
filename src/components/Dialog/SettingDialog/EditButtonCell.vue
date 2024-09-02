<!-- 現在の値+編集ボタンの設定項目 -->

<template>
  <BaseCell :title :description>
    <div class="q-px-sm text-ellipsis">
      {{ props.currentValue }}
    </div>
    <QBtn
      label="編集する"
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
    disable?: boolean;
  }
>();

const emit = defineEmits<{
  click: [];
}>();
</script>
