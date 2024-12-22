<template>
  <div v-if="nowExporting" class="export-overlay">
    <div>
      <QSpinner color="primary" size="2.5rem" />
      <div class="q-mt-xs">
        {{
          nowRendering
            ? "レンダリング中・・・"
            : `${exportingMediaName}を書き出し中・・・`
        }}
      </div>
      <QBtn
        v-if="nowRendering"
        padding="xs md"
        :label="`${exportingMediaName}の書き出しをキャンセル`"
        class="q-mt-sm"
        outline
        @click="cancelExport"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";

const store = useStore();

const nowRendering = computed(() => {
  return store.state.nowRendering;
});
const nowExporting = computed(() => {
  return store.state.exportState !== "NOT_EXPORTING";
});
const exportingMediaName = computed(() => {
  if (store.state.exportState === "EXPORTING_AUDIO") {
    return "音声";
  } else if (store.state.exportState === "EXPORTING_LABEL") {
    return "labファイル";
  } else {
    return "";
  }
});

const cancelExport = () => {
  void store.actions.CANCEL_EXPORT();
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.export-overlay {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$surface;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
