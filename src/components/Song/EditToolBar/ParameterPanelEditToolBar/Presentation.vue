<template>
  <EditToolBar>
    <template #start>
      <SongToggleGroup v-model="editTarget" type="single">
        <SongToggleGroupItem label="ボリューム" value="VOLUME" />
        <SongToggleGroupItem label="音素タイミング" value="PHONEME_TIMING" />
      </SongToggleGroup>
    </template>
    <!-- TODO: ツール名の語彙（描画・削除など）を、ピッチ・ボリューム・音素タイミングで揃える -->
    <template #center>
      <template v-if="editTarget === 'VOLUME'">
        <SongIconButton
          icon="stylus"
          label="ボリューム描画"
          size="small"
          :pressed="volumeTool === 'DRAW'"
          @click="volumeTool = 'DRAW'"
        />
        <SongIconButton
          icon="ink_eraser"
          label="ボリューム削除"
          size="small"
          :pressed="volumeTool === 'ERASE'"
          @click="volumeTool = 'ERASE'"
        />
      </template>
      <template v-else-if="editTarget === 'PHONEME_TIMING'">
        <SongIconButton
          icon="swap_horiz"
          label="移動"
          size="small"
          :pressed="phonemeTimingTool === 'MOVE'"
          @click="phonemeTimingTool = 'MOVE'"
        />
        <SongIconButton
          icon="ink_eraser"
          label="削除"
          size="small"
          :pressed="phonemeTimingTool === 'ERASE'"
          @click="phonemeTimingTool = 'ERASE'"
        />
      </template>
    </template>
  </EditToolBar>
</template>

<script setup lang="ts">
import EditToolBar from "@/components/Song/EditToolBar/EditToolBar.vue";
import SongToggleGroup from "@/components/SongBase/SongToggleGroup.vue";
import SongToggleGroupItem from "@/components/SongBase/SongToggleGroupItem.vue";
import SongIconButton from "@/components/SongBase/SongIconButton.vue";
import type {
  ParameterPanelEditTarget,
  PhonemeTimingEditTool,
  VolumeEditTool,
} from "@/store/type";

defineOptions({
  name: "ParameterPanelEditToolBarPresentation",
});

const editTarget = defineModel<ParameterPanelEditTarget>("editTarget", {
  required: true,
});
const volumeTool = defineModel<VolumeEditTool>("volumeTool", {
  required: true,
});
const phonemeTimingTool = defineModel<PhonemeTimingEditTool>(
  "phonemeTimingTool",
  { required: true },
);
</script>
