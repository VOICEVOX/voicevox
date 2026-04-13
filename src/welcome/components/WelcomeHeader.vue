<template>
  <QHeader class="q-pa-sm">
    <QToolbar>
      <QToolbarTitle class="text-display">エンジンのセットアップ</QToolbarTitle>
      <QSpace />

      <BaseTooltip
        :label="launchEditorDisabledReason || ''"
        :disabled="launchEditorDisabledReason == null"
      >
        <BaseButton
          label="エディタを起動"
          :disabled="launchEditorDisabledReason != null"
          @click="handleLaunchEditor"
        />
      </BaseTooltip>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";

const props = defineProps<{
  launchEditorDisabledReason: string | null;
}>();
const emit = defineEmits<{
  (event: "launch-editor"): void;
}>();

const handleLaunchEditor = () => {
  if (props.launchEditorDisabledReason) {
    return;
  }
  emit("launch-editor");
};
</script>
