<!--
  質問ダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <BaseDialog
    ref="dialogRef"
    v-model:open="modelValue"
    :title
    :description="message"
    :icon="
      props.type !== 'info'
        ? { name: `sym_o_${iconName}`, color: color }
        : undefined
    "
    :persistent
    @update:open="handleOpenUpdate"
  >
    <div class="footer">
      <BaseButton
        v-for="(buttonObject, index) in buttonObjects"
        ref="buttons"
        :key="index"
        :label="buttonObject.text"
        :variant="toButtonVariant(buttonObject.color)"
        @click="onClick(index)"
      />
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { QBtn, useDialogPluginComponent } from "quasar";
import { computed, onMounted, useTemplateRef } from "vue";
import { QuestionDialogButtonColor } from "../Dialog";
import { getIcon, getColor, DialogType } from "./common";
import BaseDialog from "@/components/Base/BaseDialog.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import { ExhaustiveError } from "@/type/utility";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    buttons: (string | { text: string; color: QuestionDialogButtonColor })[];
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
  props.buttons.map<{
    text: string;
    color: QuestionDialogButtonColor;
  }>((button) =>
    typeof button === "string" ? { text: button, color: "display" } : button,
  ),
);

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const buttonsRef = useTemplateRef<QBtn[]>("buttons");

const toButtonVariant = (color: QuestionDialogButtonColor) => {
  switch (color) {
    case "display":
      return "default";
    case "primary":
      return "primary";
    case "warning":
      return "danger";
    default:
      throw new ExhaustiveError(color);
  }
};

onMounted(() => {
  if (props.default != undefined) {
    buttonsRef.value?.[props.default].$el.focus();
  }
  buttonClicked = false;
});

let buttonClicked = false;

function handleOpenUpdate(isOpen: boolean) {
  if (!isOpen) {
    onDialogHide();
  }
}

const onClick = (index: number) => {
  if (buttonClicked) return;
  buttonClicked = true;
  onDialogOK({ index });
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.footer {
  display: flex;
  justify-content: end;
  gap: vars.$gap-1;
}
</style>
