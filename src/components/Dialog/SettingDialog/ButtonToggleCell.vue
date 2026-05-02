<!-- ２種類以上のボタンから１つ選ぶ設定項目 -->

<template>
  <BaseRowCard :title :description :disabled="disable">
    <BaseToggleGroup
      :modelValue="model"
      type="single"
      :disabled="disable"
      @update:modelValue="
        (val) => {
          if (typeof val !== 'undefined') model = val;
        }
      "
    >
      <template v-for="option in options" :key="option.label">
        <BaseTooltip
          v-if="option.description != null"
          :label="option.description"
        >
          <BaseToggleGroupItem :label="option.label" :value="option.value" />
        </BaseTooltip>
        <BaseToggleGroupItem
          v-else
          :label="option.label"
          :value="option.value"
        />
      </template>
    </BaseToggleGroup>
  </BaseRowCard>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import type { AcceptableValue } from "reka-ui";
import BaseRowCard from "@/components/Base/BaseRowCard.vue";
import BaseToggleGroup from "@/components/Base/BaseToggleGroup.vue";
import BaseToggleGroupItem from "@/components/Base/BaseToggleGroupItem.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";

defineProps<{
  title: string;
  description: string;
  options: { label: string; value: T; description?: string }[];
  disable?: boolean;
}>();

const model = defineModel<T | T[]>({
  required: true,
});
</script>
