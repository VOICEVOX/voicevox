<template>
  <QDialog v-model="dialogOpened" persistent>
    <QCard class="dialog-card">
      <QCardActions class="justify-end q-pa-sm">
        <QBtn
          flat
          label="キャンセル"
          color="display"
          :disable="uiLocked"
          @click="dialogOpened = false"
        />
      </QCardActions>
      <WordEditor
        v-if="dialogOpened"
        ref="wordEditor"
        :key="initialSurface"
        isNew
        :initialSurface
        initialYomi=""
        :initialWordPriority="5"
        :initialAccentType="0"
        @saveNewWord="saveNewWord"
      />
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { lockUiWhile, uiLocked } from "./common";
import WordEditor from "./WordEditor.vue";
import { useStore } from "@/store";
import { UnreachableError } from "@/type/utility";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
defineProps<{
  initialSurface: string;
}>();

const store = useStore();
const wordEditor = ref<InstanceType<typeof WordEditor>>();

const saveNewWord = async () => {
  if (!wordEditor.value)
    throw new UnreachableError("wordEditor is not defined");

  const { editState } = wordEditor.value;
  if (editState.type !== "valid") return;

  try {
    await lockUiWhile(
      store.actions.ADD_WORD({
        surface: editState.surface,
        pronunciation: editState.yomi,
        accentType: editState.accentType,
        priority: editState.wordPriority,
      }),
    );
    dialogOpened.value = false;
  } catch (e) {
    void store.actions.SHOW_ALERT_DIALOG({
      title: "単語の登録に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    window.backend.logError(e);
  }
};
</script>

<style scoped lang="scss">
.dialog-card {
  width: 720px;
  max-width: 95vw;
  max-height: 90vh;
}
</style>
