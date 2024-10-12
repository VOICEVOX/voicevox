<!-- 複数種類のオプションからSelectを用いて１つ選ぶ設定項目 -->

<template>
  <BaseRowCard
    :title
    :description
    :disabled="disable"
    clickable
    tabindex="-1"
    @click="() => (open = !open)"
  >
    <BaseSelect ref="select" v-model="model" :open :disabled="disable">
      <BaseSelectItem
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :label="option.label"
      />
    </BaseSelect>
  </BaseRowCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseRowCard from "@/components/Base/BaseRowCard.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";

defineProps<{
  title: string;
  description: string;
  disable?: boolean;
  options: { label: string; value: string }[];
}>();

const model = defineModel<string>();

const open = ref(false);
</script>
