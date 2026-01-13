<template>
  <QHeader class="q-pa-sm">
    <QToolbar>
      <QToolbarTitle class="text-display">エンジンのセットアップ</QToolbarTitle>
      <QSpace />

      <BaseTooltip
        :label="editorDisabledReason || ''"
        :disabled="editorDisabledReason == null"
      >
        <BaseButton
          label="エディタを起動"
          :disabled="editorDisabledReason != null"
          @click="handleLaunchEditor"
        />
      </BaseTooltip>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
import { defineEmits, defineProps } from "vue";

const props = defineProps<{
  editorDisabledReason: string | null;
}>();
const emit = defineEmits<{
  (event: "launch-editor"): void;
}>();

const handleLaunchEditor = () => {
  if (props.editorDisabledReason) {
    return;
  }
  emit("launch-editor");
};
</script>
