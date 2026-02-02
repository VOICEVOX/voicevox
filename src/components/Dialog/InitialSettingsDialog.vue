<template>
  <QDialog v-model="isInitialSettingsDialogOpenComputed">
    <QCard class="q-pa-md">
      <QCardSection class="dialog-text">
        <div class="text-h5">どちらに興味がありますか？</div>
        <div class="text-body2 text-grey-8">
          選択したエディタを開きます。アプリケーション右上からトークとソングを切り替えることができます。
        </div>
      </QCardSection>
      <QCardActions class="q-px-md q-py-sm">
        <div class="button-group col q-px-md">
          <QBtn
            outline
            textColor="display"
            class="text-no-wrap text-h4 text-bold q-mr-sm"
            @click="selectEditor('talk')"
            @update:modelValue="selectEditor"
          >
            <label>トーク</label>
            <QIcon
              name="mic"
              class="q-icon material-icons"
              aria-hidden="true"
              size="5rem"
            />
          </QBtn>
          <QBtn
            outline
            textColor="display"
            class="text-no-wrap text-h4 text-bold q-mr-sm"
            @click="selectEditor('song')"
            @update:modelValue="selectEditor"
          >
            <label>ソング</label>
            <QIcon
              name="music_note"
              class="q-icon material-icons"
              aria-hidden="true"
              size="5rem"
            />
          </QBtn>
        </div>
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { QIcon } from "quasar";
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
  await store.actions.SET_INIT_OPEN_EDITOR({
    editorType: editorType,
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
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 1rem;
  width: fit-content;
}
</style>
