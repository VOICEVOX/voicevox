<template>
  <div v-if="editTarget === 'NOTE'" class="tool-palette">
    <QBtn
      flat
      round
      :color="sequencerNoteTool === 'SELECT_FIRST' ? 'primary' : ''"
      @click="$emit('update:sequencerNoteTool', 'SELECT_FIRST')"
    >
      <i class="material-symbols-outlined">arrow_selector_tool</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        選択優先
      </QTooltip>
    </QBtn>
    <QBtn
      flat
      round
      :color="sequencerNoteTool === 'EDIT_FIRST' ? 'primary' : ''"
      @click="$emit('update:sequencerNoteTool', 'EDIT_FIRST')"
    >
      <i class="material-symbols-outlined">stylus</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        編集優先
      </QTooltip>
    </QBtn>
  </div>
  <div v-else-if="editTarget === 'PITCH'" class="tool-palette">
    <QBtn
      flat
      round
      :color="sequencerPitchTool === 'DRAW' ? 'primary' : ''"
      @click="$emit('update:sequencerPitchTool', 'DRAW')"
    >
      <i class="material-symbols-outlined">stylus</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        ピッチ編集
      </QTooltip>
    </QBtn>
    <QBtn
      flat
      round
      :color="sequencerPitchTool === 'ERASE' ? 'primary' : ''"
      @click="$emit('update:sequencerPitchTool', 'ERASE')"
    >
      <i class="material-symbols-outlined">ink_eraser</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        ピッチ削除
      </QTooltip>
    </QBtn>
  </div>
</template>

<script setup lang="ts">
import { SequencerEditTarget, NoteEditTool, PitchEditTool } from "@/store/type";

defineProps<{
  editTarget: SequencerEditTarget;
  sequencerNoteTool: NoteEditTool;
  sequencerPitchTool: PitchEditTool;
}>();
defineEmits<{
  (event: "update:sequencerNoteTool", value: NoteEditTool): void;
  (event: "update:sequencerPitchTool", value: PitchEditTool): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  display: flex;
  flex-direction: column;
  background: var(--scheme-color-surface);
  outline: 1px solid var(--scheme-color-outline-variant);
  position: absolute;
  top: 56px;
  left: 64px;
  z-index: var(--z-index-sing-tool-palette);
  padding: 2px;
  border-radius: 24px;
  gap: 0;
  box-shadow:
    0px 8px 16px -4px rgba(0, 0, 0, 0.1),
    0px 4px 8px -4px rgba(0, 0, 0, 0.06);

  .material-symbols-outlined {
    font-size: 20px;
    max-width: 20px;
  }

  .q-btn {
    min-height: 40px;
    min-width: 40px;
    padding: 8px;

    &.text-primary {
      background-color: var(--scheme-color-secondary-container);
      .material-symbols-outlined {
        color: var(--scheme-color-on-primary-container);
      }
    }
  }
}
</style>
