<template>
  <QHeader class="q-pa-sm">
    <QToolbar>
      <QToolbarTitle class="text-display">エンジンのセットアップ</QToolbarTitle>
      <QSpace />

      <BaseTooltip
        :label="launchEditorState.enabled ? '' : launchEditorState.reason"
        :disabled="launchEditorState.enabled"
      >
        <BaseButton
          label="エディタを起動"
          disabled
          @click="handleLaunchEditor"
        />
      </BaseTooltip>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";

export type LaunchEditorState =
  | {
      enabled: true;
    }
  | {
      enabled: false;
      reason: string;
    };

const props = defineProps<{
  launchEditorState: LaunchEditorState;
}>();
const emit = defineEmits<{
  (event: "launch-editor"): void;
}>();

const handleLaunchEditor = () => {
  if (!props.launchEditorState.enabled) {
    return;
  }
  emit("launch-editor");
};
</script>
