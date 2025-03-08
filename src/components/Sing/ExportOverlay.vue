<template>
  <div v-if="exportingInfo.nowExporting" class="export-overlay">
    <div>
      <QSpinner color="primary" size="2.5rem" />
      <div class="q-mt-xs">
        {{
          nowRendering
            ? "レンダリング中・・・"
            : `${exportingInfo.mediaName}を書き出し中・・・`
        }}
      </div>
      <!-- NOTE: 書き出しのキャンセルはレンダリング中にのみ可能 -->
      <QBtn
        v-if="nowRendering"
        padding="xs md"
        :label="`${exportingInfo.mediaName}の書き出しをキャンセル`"
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
import { ExhaustiveError } from "@/type/utility";

type ExportingInfo =
  | { nowExporting: false }
  | { nowExporting: true; mediaName: "音声" }
  | { nowExporting: true; mediaName: "labファイル" };

const store = useStore();

const nowRendering = computed(() => {
  return store.state.nowRendering;
});

const exportingInfo = computed<ExportingInfo>(() => {
  if (store.state.exportState === "NOT_EXPORTING") {
    return { nowExporting: false };
  } else if (store.state.exportState === "EXPORTING_AUDIO") {
    return { nowExporting: true, mediaName: "音声" };
  } else if (store.state.exportState === "EXPORTING_LABEL") {
    return { nowExporting: true, mediaName: "labファイル" };
  } else {
    throw new ExhaustiveError(store.state.exportState);
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
