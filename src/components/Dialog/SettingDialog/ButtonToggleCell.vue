<!-- ２種類以上のボタンから１つ選ぶ設定項目 -->

<template>
  <BaseCell :title :description>
    <QBtnToggle
      padding="xs md"
      unelevated
      color="background"
      textColor="display"
      toggleColor="primary"
      toggleTextColor="display-on-primary"
      :disable
      :modelValue
      :options="optionsForQBtnToggle"
      @update:modelValue="props['onUpdate:modelValue']"
    >
      <slot />

      <!-- FIXME: ツールチップの内容をaria-labelに付ける -->
      <template
        v-for="option in options.filter(
          (option) => option.description != undefined,
        )"
        :key="option.label"
        #[option.label]
      >
        <QTooltip :delay="500">
          {{ option.description }}
        </QTooltip>
      </template>
    </QBtnToggle>
  </BaseCell>
</template>

<script setup lang="ts" generic="T">
import { computed } from "vue";
import BaseCell, { Props as BaseCellProps } from "./BaseCell.vue";

const props = defineProps<
  BaseCellProps & {
    modelValue: T;
    // eslint-disable-next-line vue/prop-name-casing
    "onUpdate:modelValue"?: (value: T) => void;
    options: { label: string; value: T; description?: string }[];
    disable?: boolean;
  }
>();

/** QBtnToggle用のoptions */
const optionsForQBtnToggle = computed(() =>
  props.options.map((option) => ({
    label: option.label,
    value: option.value,
    slot: option.label,
  })),
);
</script>
