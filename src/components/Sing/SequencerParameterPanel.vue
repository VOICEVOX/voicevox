<template>
  <div
    class="parameter-panel"
    :class="[
      `tool-layout-${toolPaletteLayout}`,
      { 'tool-layout-docked': isParameterDockLayout },
      { 'tool-layout-header-rail': isParameterHeaderRailLayout },
      { 'tool-layout-reserved-rail': isParameterReservedRailLayout },
      { 'tool-layout-surface-strip': isParameterSurfaceStripLayout },
      { 'tool-layout-command-bar': isParameterTrueCommandLayout },
      { 'tool-layout-mode-context': isParameterModeContextLayout },
      { 'tool-layout-context-hud': isParameterContextHudLayout },
      { 'tool-layout-inspector-header': isParameterInspectorHeaderLayout },
      { 'tool-layout-tool-chip': isParameterToolChipLayout },
    ]"
  >
    <div class="tool-area" aria-label="パラメータ編集操作">
      <span v-if="isParameterTrueCommandLayout" class="surface-command-title">
        パラメータ
      </span>
      <ParameterPanelEditTargetSwitcher
        :editTarget
        :changeEditTarget
        :displayMode="usesParameterTextTabs ? 'text' : 'icon'"
      />
      <SequencerVolumeToolPalette
        v-if="
          editTarget === 'VOLUME' &&
          (isParameterInlineRailLayout ||
            isParameterInlineCommandToolLayout ||
            toolPaletteLayout === 'dock')
        "
        :sequencerVolumeTool
        :orientation="
          isParameterInlineCommandToolLayout || toolPaletteLayout === 'dock'
            ? 'horizontal'
            : 'vertical'
        "
        @update:sequencerVolumeTool="setSequencerVolumeTool"
      />
      <div
        v-if="isParameterToolChipLayout"
        class="parameter-panel-current-tool-zone"
      >
        <button
          class="current-tool-chip"
          type="button"
          :title="currentParameterToolLabel"
        >
          <span class="material-symbols-rounded" aria-hidden="true">
            {{ currentParameterToolIcon }}
          </span>
          <span>{{ currentParameterToolLabel }}</span>
        </button>
        <button
          class="command-palette-button"
          type="button"
          title="コマンドを検索"
        >
          <span class="material-symbols-rounded" aria-hidden="true">
            keyboard_command_key
          </span>
        </button>
        <div class="tool-chip-popover">
          <SequencerVolumeToolPalette
            v-if="editTarget === 'VOLUME'"
            :sequencerVolumeTool
            orientation="horizontal"
            @update:sequencerVolumeTool="setSequencerVolumeTool"
          />
        </div>
      </div>
      <button
        v-if="isParameterTrueCommandLayout"
        class="parameter-panel-command-button"
        type="button"
        title="その他"
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          more_horiz
        </span>
      </button>
    </div>
    <div
      v-if="isParameterModeContextLayout"
      class="parameter-panel-context-strip"
    >
      <span class="context-strip-target">{{ parameterModeLabel }}</span>
      <SequencerVolumeToolPalette
        v-if="editTarget === 'VOLUME'"
        :sequencerVolumeTool
        orientation="horizontal"
        @update:sequencerVolumeTool="setSequencerVolumeTool"
      />
    </div>
    <div v-if="isParameterContextHudLayout" class="parameter-panel-context-hud">
      <span class="context-hud-label">{{ currentParameterToolLabel }}</span>
      <SequencerVolumeToolPalette
        v-if="editTarget === 'VOLUME'"
        :sequencerVolumeTool
        orientation="horizontal"
        @update:sequencerVolumeTool="setSequencerVolumeTool"
      />
    </div>
    <div
      v-if="toolPaletteLayout === 'reservedRail'"
      class="parameter-panel-tool-zone"
    >
      <SequencerVolumeToolPalette
        v-if="editTarget === 'VOLUME'"
        :sequencerVolumeTool
        orientation="vertical"
        @update:sequencerVolumeTool="setSequencerVolumeTool"
      />
    </div>
    <div
      v-if="
        toolPaletteLayout !== 'rail' &&
        toolPaletteLayout !== 'proposalB' &&
        toolPaletteLayout !== 'dock' &&
        toolPaletteLayout !== 'proposalE' &&
        toolPaletteLayout !== 'proposalF' &&
        toolPaletteLayout !== 'proposalG' &&
        toolPaletteLayout !== 'proposalH' &&
        toolPaletteLayout !== 'proposalI' &&
        toolPaletteLayout !== 'proposalJ' &&
        toolPaletteLayout !== 'reservedRail'
      "
      class="parameter-panel-floating-tools"
      :class="[
        `layout-${toolPaletteLayout}`,
        { 'active-target-volume': editTarget === 'VOLUME' },
      ]"
    >
      <div class="parameter-panel-tool-palette">
        <SequencerVolumeToolPalette
          v-if="editTarget === 'VOLUME'"
          :sequencerVolumeTool
          :orientation="parameterToolPaletteOrientation"
          @update:sequencerVolumeTool="setSequencerVolumeTool"
        />
      </div>
    </div>
    <div class="edit-area">
      <SequencerPhonemeTimingEditor
        v-if="editTarget === 'PHONEME_TIMING'"
        :viewportInfo
      />
      <SequencerVolumeEditor
        v-if="editTarget === 'VOLUME'"
        :offsetX="viewportInfo.offsetX"
        @update:needsAutoScroll="
          (value) => emit('update:needsAutoScroll', value)
        "
        @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
        @zoomTimeline="
          (anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor.vue";
import { useStore } from "@/store";
import type { ParameterPanelEditTarget, VolumeEditTool } from "@/store/type";
import ParameterPanelEditTargetSwitcher from "@/components/Sing/ParameterPanelEditTargetSwitcher.vue";
import SequencerPhonemeTimingEditor from "@/components/Sing/SequencerPhonemeTimingEditor.vue";
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";
import type { ToolPaletteLayout } from "@/components/Sing/toolPaletteLayout";
import type { ViewportInfo } from "@/sing/viewHelper";

const props = defineProps<{
  viewportInfo: ViewportInfo;
  toolPaletteLayout: ToolPaletteLayout;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const store = useStore();

const editTarget = computed(() => store.state.parameterPanelEditTarget);
const isParameterInlineRailLayout = computed(
  () =>
    props.toolPaletteLayout === "rail" ||
    props.toolPaletteLayout === "proposalB",
);
const isParameterDockLayout = computed(
  () =>
    props.toolPaletteLayout === "dock" ||
    props.toolPaletteLayout === "dockCenter",
);
const isParameterHeaderRailLayout = computed(
  () => props.toolPaletteLayout === "proposalC",
);
const isParameterReservedRailLayout = computed(
  () => props.toolPaletteLayout === "reservedRail",
);
const isParameterSurfaceStripLayout = computed(
  () =>
    props.toolPaletteLayout === "proposalE" ||
    props.toolPaletteLayout === "proposalF" ||
    props.toolPaletteLayout === "proposalI" ||
    props.toolPaletteLayout === "proposalJ",
);
const isParameterInlineCommandToolLayout = computed(
  () =>
    props.toolPaletteLayout === "proposalE" ||
    props.toolPaletteLayout === "proposalF" ||
    props.toolPaletteLayout === "proposalI",
);
const isParameterTrueCommandLayout = computed(
  () => props.toolPaletteLayout === "proposalF",
);
const isParameterModeContextLayout = computed(
  () => props.toolPaletteLayout === "proposalG",
);
const isParameterContextHudLayout = computed(
  () => props.toolPaletteLayout === "proposalH",
);
const isParameterInspectorHeaderLayout = computed(
  () => props.toolPaletteLayout === "proposalI",
);
const isParameterToolChipLayout = computed(
  () => props.toolPaletteLayout === "proposalJ",
);
const usesParameterTextTabs = computed(
  () =>
    isParameterDockLayout.value ||
    isParameterHeaderRailLayout.value ||
    isParameterSurfaceStripLayout.value,
);
const parameterToolPaletteOrientation = computed<"vertical" | "horizontal">(
  () =>
    props.toolPaletteLayout === "center" ||
    props.toolPaletteLayout === "centerBottom" ||
    props.toolPaletteLayout === "dockCenter"
      ? "horizontal"
      : "vertical",
);

const changeEditTarget = (editTarget: ParameterPanelEditTarget) => {
  void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({ editTarget });
};

const sequencerVolumeTool = computed(() => store.state.sequencerVolumeTool);
const setSequencerVolumeTool = (sequencerVolumeTool: VolumeEditTool) => {
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({ sequencerVolumeTool });
};

const parameterModeLabel = computed(() =>
  editTarget.value === "VOLUME" ? "ボリューム" : "音素位置",
);
const currentParameterToolLabel = computed(() => {
  if (editTarget.value === "PHONEME_TIMING") return "音素位置";

  switch (sequencerVolumeTool.value) {
    case "SELECT":
      return "選択";
    case "DRAW":
      return "描画";
    case "ERASE":
      return "消去";
    case "CUT":
      return "分割";
    case "SMOOTH":
      return "補正";
  }

  return "選択";
});
const currentParameterToolIcon = computed(() => {
  if (editTarget.value === "PHONEME_TIMING") return "timer";

  switch (sequencerVolumeTool.value) {
    case "SELECT":
      return "arrow_selector_tool";
    case "DRAW":
      return "stylus";
    case "ERASE":
      return "ink_eraser";
    case "CUT":
      return "content_cut";
    case "SMOOTH":
      return "auto_fix_high";
  }

  return "arrow_selector_tool";
});
</script>

<style scoped lang="scss">
.parameter-panel {
  --editor-tool-rail-width: 40px;

  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-columns: var(--editor-tool-rail-width) minmax(0, 1fr);
  grid-template-rows: 1fr;
}

.parameter-panel.tool-layout-docked,
.parameter-panel.tool-layout-surface-strip {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 36px 1fr;
}

.parameter-panel.tool-layout-header-rail {
  grid-template-columns: var(--editor-tool-rail-width) minmax(0, 1fr);
  grid-template-rows: 36px 1fr;
}

.parameter-panel.tool-layout-mode-context {
  grid-template-columns: var(--editor-tool-rail-width) minmax(0, 1fr);
  grid-template-rows: 36px 1fr;
}

.parameter-panel.tool-layout-reserved-rail {
  grid-template-columns:
    var(--editor-tool-rail-width) var(--editor-tool-rail-width)
    minmax(0, 1fr);
}

.tool-area {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 6px;
  padding-top: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.parameter-panel-tool-zone {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 44%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  pointer-events: auto;
  z-index: 2;
}

.tool-layout-docked .tool-area {
  grid-column: 1;
  grid-row: 1;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 2px 8px 0 56px;
  background: transparent;
  border-right: 0;
}

.tool-layout-surface-strip .tool-area {
  grid-column: 1;
  grid-row: 1;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 2px 12px 0;
  background: color-mix(in oklch, var(--scheme-color-surface) 94%, transparent);
  border-right: 0;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 36%, transparent);
}

.tool-layout-command-bar .tool-area {
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-lowest) 96%,
    transparent
  );
}

.surface-command-title {
  display: grid;
  place-items: center;
  height: 24px;
  padding: 0 10px 0 0;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 52%, transparent);
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  pointer-events: auto;
}

.tool-layout-header-rail .tool-area {
  grid-column: 1 / -1;
  grid-row: 1;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 2px 8px 0 88px;
  background: transparent;
  border-right: 0;
}

.tool-layout-mode-context .tool-area {
  grid-column: 1;
  grid-row: 1 / -1;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 6px;
  padding-top: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.tool-layout-docked .tool-area :deep(.edit-target-switcher),
.tool-layout-surface-strip .tool-area :deep(.edit-target-switcher),
.tool-layout-header-rail .tool-area :deep(.edit-target-switcher) {
  flex-direction: row;
  width: auto;
}

.tool-layout-proposalB .tool-area {
  gap: 14px;
}

.tool-area :deep(.edit-target-switcher),
.tool-area :deep(.tool-palette) {
  pointer-events: auto;
}

.parameter-panel-context-strip {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 7px;
  background: color-mix(in oklch, var(--scheme-color-surface) 94%, transparent);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.12);
  pointer-events: auto;
  z-index: 2;
}

.context-strip-target,
.context-hud-label {
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.parameter-panel-context-hud {
  position: absolute;
  top: 12px;
  left: calc(var(--editor-tool-rail-width) + 12px);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 1px 8px 1px 10px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in oklch, var(--scheme-color-surface) 90%, transparent);
  box-shadow: 0 6px 18px oklch(0% 0 0 / 0.16);
  backdrop-filter: blur(6px);
  pointer-events: auto;
  z-index: 2;
}

.parameter-panel-current-tool-zone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.current-tool-chip,
.command-palette-button,
.parameter-panel-command-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 0;
  border-radius: 7px;
  background: color-mix(in oklch, var(--scheme-color-surface) 92%, transparent);
  color: var(--scheme-color-on-surface-variant);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.12);
  cursor: pointer;

  &:hover {
    background: var(--scheme-color-surface-container-highest);
    color: var(--scheme-color-on-surface);
  }
}

.current-tool-chip {
  gap: 6px;
  min-width: 88px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
}

.command-palette-button,
.parameter-panel-command-button {
  width: 32px;
  padding: 0;
}

.current-tool-chip .material-symbols-rounded,
.command-palette-button .material-symbols-rounded,
.parameter-panel-command-button .material-symbols-rounded {
  font-size: 18px;
  line-height: 1;
}

.tool-chip-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
  z-index: 2;
}

.parameter-panel-current-tool-zone:hover .tool-chip-popover,
.parameter-panel-current-tool-zone:focus-within .tool-chip-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.tool-layout-command-bar .parameter-panel-command-button {
  margin-left: auto;
}

.tool-layout-inspector-header .tool-area {
  background: var(--scheme-color-surface-container-low);
}

.tool-layout-inspector-header .tool-area :deep(.text-mode) {
  align-self: stretch;
  gap: 6px;
  height: 34px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.tool-layout-inspector-header .tool-area :deep(.segment-switch) {
  min-width: 78px;
  height: 34px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.tool-layout-inspector-header .tool-area :deep(.segment-switch.active) {
  border-bottom: 2px solid var(--scheme-color-secondary);
  background: transparent;
  color: var(--scheme-color-on-surface);
  box-shadow: none;
}

.parameter-panel-floating-tools {
  grid-row: 1;
  z-index: 2;
  pointer-events: none;
}

.parameter-panel-floating-tools.layout-center {
  grid-column: 2;
  align-self: start;
  justify-self: center;
  margin-top: 8px;
}

.parameter-panel-floating-tools.layout-centerBottom {
  grid-column: 2;
  align-self: end;
  justify-self: center;
  margin-bottom: 10px;
}

.parameter-panel-floating-tools.layout-proposalA,
.parameter-panel-floating-tools.layout-proposalD {
  grid-column: 1 / -1;
  align-self: start;
  justify-self: start;
  margin: 40px 0 0 calc(var(--editor-tool-rail-width) + 6px);
}

.parameter-panel-floating-tools.layout-proposalC {
  grid-column: 1;
  grid-row: 2;
  align-self: start;
  justify-self: center;
  margin-top: 6px;
}

.tool-layout-proposalD .parameter-panel-floating-tools {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
}

.tool-layout-proposalD .tool-area:hover ~ .parameter-panel-floating-tools,
.tool-layout-proposalD .parameter-panel-floating-tools:hover,
.tool-layout-proposalD
  .tool-area:focus-within
  ~ .parameter-panel-floating-tools,
.tool-layout-proposalD .parameter-panel-floating-tools:focus-within {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.parameter-panel-floating-tools.layout-dockCenter {
  grid-column: 1;
  align-self: center;
  justify-self: center;
}

.parameter-panel-floating-tools.layout-side {
  grid-column: 1 / -1;
  align-self: start;
  justify-self: end;
  margin: 6px 12px 0 0;
}

.parameter-panel-tool-palette :deep(.tool-palette) {
  pointer-events: auto;
}

.edit-area {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  overflow: hidden;
}

.tool-layout-reserved-rail .edit-area {
  grid-column: 3;
}

.tool-layout-docked .edit-area,
.tool-layout-surface-strip .edit-area {
  grid-column: 1;
  grid-row: 2;
}

.tool-layout-header-rail .edit-area {
  grid-column: 2;
  grid-row: 2;
}

.tool-layout-mode-context .edit-area {
  grid-column: 2;
  grid-row: 2;
}
</style>
