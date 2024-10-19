<!--
  ブラウザ版の質問ダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <QDialog
    ref="dialogRef"
    v-model="modelValue"
    :persistent
    @hide="onDialogHide"
  >
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection class="title">
        <QIcon
          v-if="props.type !== 'none'"
          :name="iconName"
          class="text-h5 q-mr-sm"
          :color
        />
        <div class="text-h5" :class="[`text-${color}`]">{{ props.title }}</div>
      </QCardSection>

      <QCardSection class="q-py-none message">
        {{ props.message }}
      </QCardSection>
      <QCardActions align="right">
        <QSpace />
        <QBtn
          v-for="(button, index) in props.buttons"
          ref="buttons"
          :key="index"
          flat
          :label="button"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold"
          @click="onClick(index)"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { QBtn, useDialogPluginComponent } from "quasar";
import { computed, onMounted, useTemplateRef } from "vue";
import { getIcon, getColor, DialogType } from "./common";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    buttons: string[];
    persistent?: boolean | undefined;
    default?: number | undefined;
  }>(),
  {
    persistent: true,
    default: undefined,
  },
);
defineEmits({
  ...useDialogPluginComponent.emitsObject,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  "update:modelValue": (val: boolean) => true,
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const buttonsRef = useTemplateRef<QBtn[]>("buttons");

onMounted(() => {
  if (props.default != undefined) {
    buttonsRef.value?.[props.default].$el.focus();
  }
  buttonClicked = false;
});

let buttonClicked = false;

const onClick = (index: number) => {
  if (buttonClicked) return;
  buttonClicked = true;
  onDialogOK({ index });
};
</script>
<style scoped lang="scss">
.title {
  display: flex;
  align-items: center;
}

.message {
  white-space: pre-wrap;
}
</style>
