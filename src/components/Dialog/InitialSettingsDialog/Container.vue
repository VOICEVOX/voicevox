<template>
  <Presentation v-model="isDialogOpen" @select="selectEditor" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import type { EditorType } from "@/type/preload";

defineOptions({
  name: "InitialSettingsDialog",
});

const props = defineProps<{
  canOpenDialog: boolean;
}>();

const store = useStore();

const isDialogOpen = computed({
  get: () => props.canOpenDialog && store.state.isInitialSettingsDialogOpen,
  set: (value) =>
    store.actions.SET_DIALOG_OPEN({
      isInitialSettingsDialogOpen: value,
    }),
});

const selectEditor = async (editor: EditorType) => {
  await store.actions.SET_ROOT_MISC_SETTING({
    key: "openedEditor",
    value: editor,
  });
  await store.actions.SET_DIALOG_OPEN({
    isInitialSettingsDialogOpen: false,
  });
};
</script>
