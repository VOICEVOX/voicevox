<template>
  <QDialog v-model="isInitialSettingsDialogOpenComputed">
    <QCard class="q-pa-md">
      <QCardSection class="dialog-text">
        <div class="text-h5">どちらに興味がありますか？</div>
        <div class="text-body2 text-grey-8">
          選択したエディタを開きます。アプリケーション右上からトークとソングを切り替えることができます。
        </div>
      </QCardSection>
      <QCardActions class="button-group q-px-md q-py-sm">
        <div class="col q-px-md">
          <QBtn
            label="トーク"
            outline
            textColor="display"
            class="text-no-wrap text-bold q-mr-sm"
            @click="selectEditor('talk')"
            @update:modelValue="selectEditor"
          />
          <QBtn
            label="ソング"
            outline
            textColor="display"
            class="text-no-wrap text-bold q-mr-sm"
            @click="selectEditor('song')"
            @update:modelValue="selectEditor"
          />
        </div>
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { EditorType } from "@/type/preload";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const isInitialSettingsDialogOpenComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const store = useStore();

const selectEditor = async (editorType: EditorType) => {
  await store.actions.SET_ROOT_MISC_SETTING({
    key: "openedEditor",
    value: editorType,
  });

  isInitialSettingsDialogOpenComputed.value = false;
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.dialog-text {
  text-align: center;
}
.button-group {
  justify-content: center;
}
</style>
