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
          :disabled="!launchEditorState.enabled"
          @click="store.switchToMainWindow"
        />
      </BaseTooltip>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
import { useStore } from "@/welcome/store";

const store = useStore();
const { launchEditorState } = store;
</script>
