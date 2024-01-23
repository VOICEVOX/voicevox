<template>
  <presentation
    :loading
    :character-infos="props.characterInfos"
    :selected-voice="props.selectedVoice"
    :show-engine-info="props.showEngineInfo"
    :emptiable
    :ui-locked="props.uiLocked"
    :engine-icons="engineIcons"
    :default-style-ids="defaultStyleIds"
    @select="emit('update:selectedVoice', $event)"
  />
</template>
<script lang="ts">
export default {
  name: "CharacterButton",
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { useStore } from "@/store";
import { CharacterInfo, Voice } from "@/type/preload";

const props = withDefaults(
  defineProps<{
    characterInfos: CharacterInfo[];
    loading?: boolean;
    selectedVoice: Voice | undefined;
    showEngineInfo?: boolean;
    emptiable?: boolean;
    uiLocked: boolean;
  }>(),
  {
    loading: false,
    showEngineInfo: false,
    emptiable: false,
  }
);

const emit = defineEmits({
  "update:selectedVoice": (selectedVoice: Voice | undefined) => {
    return (
      selectedVoice == undefined ||
      (typeof selectedVoice.engineId === "string" &&
        typeof selectedVoice.speakerId === "string" &&
        typeof selectedVoice.styleId === "number")
    );
  },
});

const store = useStore();

const defaultStyleIds = computed(() =>
  Object.fromEntries(
    store.state.defaultStyleIds.map((defaultStyleId) => [
      defaultStyleId.speakerUuid,
      {
        engineId: defaultStyleId.engineId,
        styleId: defaultStyleId.defaultStyleId,
      },
    ])
  )
);

const engineIcons = computed(() =>
  Object.fromEntries(
    store.state.engineIds.map((engineId) => [
      engineId,
      base64ImageToUri(store.state.engineManifests[engineId].icon),
    ])
  )
);
</script>
