<!--
  質問ダイアログ。
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
          v-if="props.type !== 'info'"
          :name="`sym_o_${iconName}`"
          size="2rem"
          class="q-mr-sm"
          :color
        />
        <div class="text-h5">{{ props.title }}</div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="message">
        {{ props.message }}
      </QCardSection>

      <QSeparator />

      <QCardActions align="right">
        <QSpace />
        <QBtn
          v-for="(buttonObject, index) in buttonObjects"
          ref="buttons"
          :key="index"
          :outline="buttonObject.color == 'display'"
          :unelevated="buttonObject.color != 'display'"
          :label="buttonObject.text"
          :color="buttonObject.color"
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
    buttons: (string | { text: string; color: string })[];
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
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const buttonObjects = computed(() =>
  props.buttons.map((button) =>
    typeof button === "string" ? { text: button, color: "display" } : button,
  ),
);

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

// primary色のボタンのテキスト色は特別扱い
.q-btn.bg-primary {
  color: var(--color-display-on-primary) !important;
}
</style>
