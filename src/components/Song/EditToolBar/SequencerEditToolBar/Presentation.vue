<template>
  <EditToolBar>
    <template #start>
      <SongToggleGroup v-model="editTarget" type="single">
        <SongToggleGroupItem label="ノート" value="NOTE" />
        <SongToggleGroupItem label="ピッチ" value="PITCH" />
      </SongToggleGroup>
    </template>
    <!-- TODO: ツール名の語彙（描画・削除など）を、ピッチ・ボリューム・音素タイミングで揃える -->
    <template #center>
      <template v-if="editTarget === 'NOTE'">
        <SongIconButton
          icon="arrow_selector_tool"
          label="選択優先"
          size="small"
          :pressed="noteTool === 'SELECT_FIRST'"
          @click="noteTool = 'SELECT_FIRST'"
        />
        <SongIconButton
          icon="stylus"
          label="編集優先"
          size="small"
          :pressed="noteTool === 'EDIT_FIRST'"
          @click="noteTool = 'EDIT_FIRST'"
        />
      </template>
      <template v-else-if="editTarget === 'PITCH'">
        <SongIconButton
          icon="stylus"
          label="ピッチ編集"
          size="small"
          :pressed="pitchTool === 'DRAW'"
          @click="pitchTool = 'DRAW'"
        />
        <SongIconButton
          icon="ink_eraser"
          label="ピッチ削除"
          size="small"
          :pressed="pitchTool === 'ERASE'"
          @click="pitchTool = 'ERASE'"
        />
      </template>
    </template>
    <template #end>
      <SongSelect v-model="snapType" label="スナップ">
        <SongSelectItem
          v-for="option in snapTypeOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </SongSelect>
    </template>
  </EditToolBar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EditToolBar from "@/components/Song/EditToolBar/EditToolBar.vue";
import SongToggleGroup from "@/components/SongBase/SongToggleGroup.vue";
import SongToggleGroupItem from "@/components/SongBase/SongToggleGroupItem.vue";
import SongIconButton from "@/components/SongBase/SongIconButton.vue";
import SongSelect from "@/components/SongBase/SongSelect.vue";
import SongSelectItem from "@/components/SongBase/SongSelectItem.vue";
import { isTriplet } from "@/song/music";
import type {
  NoteEditTool,
  PitchEditTool,
  SequencerEditTarget,
} from "@/store/type";

defineOptions({
  name: "SequencerEditToolBarPresentation",
});

const props = defineProps<{
  snapTypes: number[];
}>();

const editTarget = defineModel<SequencerEditTarget>("editTarget", {
  required: true,
});
const noteTool = defineModel<NoteEditTool>("noteTool", { required: true });
const pitchTool = defineModel<PitchEditTool>("pitchTool", { required: true });
const snapType = defineModel<number>("snapType", { required: true });

const snapTypeOptions = computed(() =>
  props.snapTypes
    .toSorted((a, b) => {
      if (isTriplet(a) === isTriplet(b)) {
        return a - b;
      } else {
        return isTriplet(a) ? 1 : -1;
      }
    })
    .map((snapType) => ({
      value: snapType,
      label: isTriplet(snapType)
        ? `1/${(snapType / 3) * 2} T`
        : `1/${snapType}`,
    })),
);
</script>
