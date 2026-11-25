<template>
  <QHeader class="q-pa-sm">
    <QToolbar>
      <QToolbarTitle class="text-display">エンジンのセットアップ</QToolbarTitle>
      <QSpace />

      <BaseTooltip
        :label="launchEditorState.enabled ? '' : launchEditorState.reason"
        :disabled="launchEditorState.enabled"
      >
        <QBtn
          unelevated
          label="エディタを起動"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold"
          :disable="!launchEditorState.enabled"
          @click="store.switchToMainWindow"
        />
      </BaseTooltip>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import { useStore } from "../store";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";

const store = useStore();
const { launchEditorState } = store;
</script>
